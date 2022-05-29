import { App, Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from "obsidian";
import { ESearchColumnsTypes } from "src/searchView";
import { COMPACT_SYMBOL, IJiraIssueSettings } from "src/settings";

interface DictionaryEntry {
    name: string
    isCompact: boolean
    isCustomField: boolean
}

export class ColumnsSuggest extends EditorSuggest<DictionaryEntry> {
    private _settings: IJiraIssueSettings

    constructor(app: App, settings: IJiraIssueSettings) {
        super(app)
        this._settings = settings
    }

    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo | null {
        console.log('0')
        // console.log('onTrigger', { cursor, editor, file })
        const cursorLine = editor.getLine(cursor.line)
        // check line contains prefix "columns:"
        console.log('1')
        if (!cursorLine.match(/^\s*columns\s*:/)) {
            return null
        }
        // check cursor is after "columns:"
        console.log('2')
        if (!cursorLine.substring(0, cursor.ch).match(/^\s*columns\s*:/)) {
            return null
        }
        // check cursor inside jira-search fence
        console.log('3')
        let jiraSearchFenceStartFound = false
        for (let i = cursor.line - 1; i >= 0; i--) {
            const line = editor.getLine(i)
            if (line.match(/^\s*```\s*jira-search/)) {
                jiraSearchFenceStartFound = true
                break
            }
        }
        console.log('4')
        if (!jiraSearchFenceStartFound) {
            return null
        }
        console.log('continue')

        const strBeforeCursor = cursorLine.substring(0, cursor.ch)
        const strAfterColumnsKey = strBeforeCursor.split(':').slice(1).join(':')
        const lastColumn = strAfterColumnsKey.split(',').pop()

        return {
            start: { line: cursor.line, ch: cursor.ch - lastColumn.length },
            end: cursor,
            query: lastColumn,
        }
    }

    getSuggestions(context: EditorSuggestContext): DictionaryEntry[] | Promise<DictionaryEntry[]> {
        const suggestions: DictionaryEntry[] = []
        let query = context.query.trim().toUpperCase()
        const isCompact = query.startsWith(COMPACT_SYMBOL)
        query = query.replace(new RegExp(`^${COMPACT_SYMBOL}`), '')

        console.log(query)

        // Standard fields
        if (!query.startsWith('$')) {
            for (const column of Object.values(ESearchColumnsTypes)) {
                if (suggestions.length >= this.limit) break
                if (column.startsWith(query) && column !== ESearchColumnsTypes.CUSTOM_FIELD) {
                    suggestions.push({
                        name: column,
                        isCompact: isCompact,
                        isCustomField: false,
                    })
                }
            }
        }
        // Custom fields
        query = query.replace(/^\$/, '')
        let customFieldsOptions = []
        if (Number(query)) {
            customFieldsOptions = Object.keys(this._settings.customFieldsIdToName)
        } else {
            customFieldsOptions = Object.keys(this._settings.customFieldsNameToId)
        }
        for (const column of customFieldsOptions) {
            if (suggestions.length >= this.limit) break
            if (column.toUpperCase().startsWith(query)) {
                suggestions.push({
                    name: column,
                    isCompact: isCompact,
                    isCustomField: true,
                })
            }
        }

        return suggestions
    }

    renderSuggestion(value: DictionaryEntry, el: HTMLElement): void {
        // console.log('renderSuggestion', { value, el })
        if (value.isCompact) {
            el.createSpan({ text: COMPACT_SYMBOL, cls: 'jira-issue-suggestion is-compact' })
        }
        if (value.isCustomField) {
            el.createSpan({ text: '$', cls: 'jira-issue-suggestion is-custom-field' })
        }
        el.createSpan({ text: value.name, cls: 'jira-issue-suggestion' })
    }

    selectSuggestion(value: DictionaryEntry, evt: MouseEvent | KeyboardEvent): void {
        // console.log('selectSuggestion', { value, evt }, this.context)
        if (!this.context) return

        const selectedColumn = ' ' + (value.isCompact ? COMPACT_SYMBOL : '') + (value.isCustomField ? '$' : '') + value.name + ', '
        this.context.editor.replaceRange(selectedColumn, this.context.start, this.context.end, 'jira-issue')
    }
}