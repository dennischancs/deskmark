import type { VNode } from 'snabbdom';
import type { Muya } from '../../index';
import type {
    IQuickInsertMenuItem,
} from './config';
import Fuse from 'fuse.js';
import { canInsertLabel, replaceBlockByLabel } from '../../block/blockTransforms';
import ParagraphContent from '../../block/content/paragraphContent';
import { deepClone } from '../../utils';
import { query } from '../../utils/dom';
import { h, patch } from '../../utils/snabbdom';
import BaseScrollFloat from '../baseScrollFloat';
import {
    getLabelFromEvent,
    MENU_CONFIG,
} from './config';

import './index.css';

const checkQuickInsert = (text: string) => /^[/、]\S*$/.test(text);
const checkShowPlaceholder = (text: string) => /^[/、]$/.test(text);
const mentionQuery = (text: string): string | null => {
    if (!/(?:^|\s)@\S*$/.test(text) || /\w@\S*$/.test(text))
        return null;
    return /(?:^|\s)@(\S*)$/.exec(text)?.[1] ?? '';
};
function checkCanInsertFrontMatter(muya: Muya, block: ParagraphContent) {
    const { frontMatter } = muya.options;

    return (
        frontMatter
        && !block.parent?.prev
        && block.parent?.parent?.blockName === 'scrollpage'
    );
}

export class ParagraphQuickInsertMenu extends BaseScrollFloat {
    static pluginName = 'quickInsert';
    public override capturesContentKeydown = true;

    public oldVNode: VNode | null = null;
    private _block: ParagraphContent | null = null;
    private _mention = false;
    public override activeItem: IQuickInsertMenuItem['children'][number] | null = null;
    public override renderArray: IQuickInsertMenuItem['children'] = [];
    private _renderData: IQuickInsertMenuItem[] = [];

    constructor(muya: Muya) {
        const name = 'mu-quick-insert';
        super(muya, name);
        this.renderArray = [];
        this.renderData = MENU_CONFIG;
        this.render();
        this.listen();
    }

    get renderData() {
        return this._renderData;
    }

    set renderData(data) {
        this._renderData = data;

        this.renderArray = data.flatMap(d => d.children);
        if (this.renderArray.length > 0) {
            this.activeItem = this.renderArray[0];
            const activeEle = this.getItemElement(this.activeItem);
            if (activeEle)
                this.activeEleScrollIntoView(activeEle);
        }
    }

    override listen() {
        super.listen();
        const { eventCenter, editor, domNode, i18n } = this.muya;

        eventCenter.subscribe('content-change', ({ block }) => {
            // Check weather need to show quick insert panel
            if (block.blockName !== 'paragraph.content')
                return;

            const { text, domNode } = block;
            const needToShowQuickInsert = checkQuickInsert(text);
            const atQuery = mentionQuery(text);
            const needToShowPlaceholder = checkShowPlaceholder(text);
            if (needToShowPlaceholder)
                domNode!.setAttribute('placeholder', i18n.t('Search keyword...'));
            else
                domNode!.removeAttribute('placeholder');

            if (needToShowQuickInsert || atQuery !== null) {
                this._block = block;
                this._mention = atQuery !== null && !needToShowQuickInsert;
                this.show(domNode);
                this._search(needToShowQuickInsert ? text.substring(1) : atQuery!);
            }
            else {
                this.hide();
            }
        });

        const handleKeydown = (event: Event) => {
            const selectionResult = editor.selection.getSelection();
            const anchorBlock = selectionResult?.anchor.block;
            const isSelectionInSameBlock = selectionResult?.isSelectionInSameBlock;
            if (isSelectionInSameBlock && anchorBlock instanceof ParagraphContent) {
                if (anchorBlock.text)
                    return;

                const label = getLabelFromEvent(event);
                if (label) {
                    event.preventDefault();
                    replaceBlockByLabel({
                        label,
                        block: anchorBlock.parent!,
                        muya: this.muya,
                    });
                }
            }
        };

        eventCenter.attachDOMEvent(domNode, 'keydown', handleKeydown);
        eventCenter.attachDOMEvent(this.container!, 'mousemove', (event: Event) => {
            this.container!.classList.remove('mu-keyboard-navigation');
            if (!(event.target instanceof Element))
                return;

            const itemElement = event.target.closest<HTMLElement>('.item');
            if (!itemElement || !this.container!.contains(itemElement))
                return;

            const item = this.renderArray.find(({ label }) => {
                return label === itemElement.dataset.label;
            });
            if (item && item !== this.activeItem)
                this.activeItem = item;
        });
    }

    override step(direction: 'previous' | 'next') {
        this.container!.classList.add('mu-keyboard-navigation');
        super.step(direction);
    }

    override hide() {
        this.container!.classList.remove('mu-keyboard-navigation');
        super.hide();
    }

    render() {
        const { scrollElement, activeItem, renderData } = this;
        const { i18n } = this.muya;
        let children = renderData.map((section) => {
            const titleVnode = h('div.title', i18n.t(section.name).toUpperCase());
            const items = [];

            for (const item of section.children) {
                const { title, subTitle, label, icon, shortCut } = item;
                const iconVnode = h(
                    'div.icon-container',
                    h(
                        'i.icon',
                        h(
                            `i.icon-${label.replace(/\s/g, '-')}`,
                            {
                                style: {
                                    'background': `url(${icon}) no-repeat`,
                                    'background-size': '100%',
                                },
                            },
                            '',
                        ),
                    ),
                );

                const description = h('div.description', [
                    h(
                        'div.big-title',
                        {
                            attrs: { title: subTitle },
                        },
                        i18n.t(title),
                    ),
                ]);
                const shortCutVnode = h('div.short-cut', [h('span', shortCut)]);
                const selector
                    = activeItem!.label === label ? 'div.item.active' : 'div.item';
                items.push(
                    h(
                        selector,
                        {
                            dataset: { label },
                            on: {
                                click: () => {
                                    this.selectItem(item);
                                },
                            },
                        },
                        [iconVnode, description, shortCutVnode],
                    ),
                );
            }

            return h('section', [titleVnode, ...items]);
        });

        if (children.length === 0)
            children = [h('div.no-result', i18n.t('No result'))];

        const vnode = h('div', children);

        if (this.oldVNode)
            patch(this.oldVNode, vnode);
        else
            patch(scrollElement!, vnode);

        this.oldVNode = vnode;
    }

    private _search(text: string) {
        const { muya, _block: block } = this;
        const { i18n } = muya;
        if (this._mention) {
            const base = deepClone(MENU_CONFIG).find(menu => menu.name === 'deskmark');
            const mentions = (base?.children ?? []).filter(child => /today|tomorrow|journal/i.test(child.label) || child.label === 'deskmark:today' || child.label === 'deskmark:tomorrow' || child.label === 'deskmark:journal');
            const notes = (muya.deskmarkNotes ?? []).map(note => ({
                title: note.title,
                subTitle: note.href,
                label: `deskmark:note:${encodeURIComponent(note.href)}`,
                icon: mentions[0]?.icon ?? '',
            }));
            const children = [...mentions, ...notes].filter(child => text === '' || child.title.toLowerCase().includes(text.toLowerCase()));
            this.renderData = children.length ? [{ name: 'deskmark', children }] : [];
            this.render();
            return;
        }
        const canInsertFrontMatter = checkCanInsertFrontMatter(muya, block!);
        const menuConfig = deepClone(MENU_CONFIG);

        if (!canInsertFrontMatter) {
            menuConfig
                .find(menu => menu.name === 'basic blocks')
                ?.children
                .splice(2, 1);
        }

        for (const menu of menuConfig)
            menu.children = menu.children.filter(child => canInsertLabel(child.label, muya));
        let result = menuConfig;
        if (text !== '') {
            result = [];

            for (const menu of menuConfig) {
                for (const child of menu.children)
                    child.i18nTitle = i18n.t(child.title);

                const fuse = new Fuse(menu.children, {
                    includeScore: true,
                    keys: ['i18nTitle', 'title'],
                });
                const match = fuse
                    .search(text)
                    .map(i => ({ score: i.score, ...i.item }));
                if (match.length) {
                    result.push({
                        name: menu.name,
                        children: match,
                    });
                }
            }

            if (result.length) {
                result.sort((a, b) => {
                    return a.children[0].score! < b.children[0].score! ? -1 : 1;
                });
            }
        }
        this.renderData = result;
        this.render();
    }

    override selectItem({ label }: IQuickInsertMenuItem['children'][number]) {
        const { _block: block, muya } = this;
        if (label.startsWith('deskmark:')) {
            const parentName = block?.parent?.parent && 'blockName' in block.parent.parent
                ? (block.parent.parent as { blockName?: string }).blockName
                : '';
            this.muya.eventCenter.emit('deskmark-insert', {
                label,
                text: block?.text ?? '',
                insideTask: parentName === 'task-list-item',
                replaceWithTask: (next: string) => {
                    if (block?.parent)
                        replaceBlockByLabel({ label: 'task-list', text: next, block: block.parent, muya });
                },
                setText: (next: string) => {
                    if (block)
                        block.text = next;
                },
            });
            setTimeout(this.hide.bind(this));
            return;
        }
        if (block?.outMostBlock) {
            replaceBlockByLabel({
                label,
                block: block.parent!,
                muya,
            });
        }
        // delay hide to avoid dispatch enter handler
        setTimeout(this.hide.bind(this));
    }

    getItemElement(item: IQuickInsertMenuItem['children'][number]) {
        const { label } = item;

        return query<HTMLElement>(`[data-label="${label}"]`, this.scrollElement!);
    }
}
