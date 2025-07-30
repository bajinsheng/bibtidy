// ==UserScript==
// @name         BibTidy plugin for Overleaf Editor
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Simple BibTeX validation in Overleaf
// @author       Jinsheng BA
// @match        https://www.overleaf.com/project/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @license      MIT
// @homepage     https://github.com/bajinsheng/bibtidy
// ==/UserScript==

(function() {
    'use strict';

    // Grammarly-like styles
    GM_addStyle(`
        .bibtex-error-icon {
            position: absolute;
            width: 14px;
            height: 14px;
            background: #ff4d4f;
            border-radius: 50%;
            color: white;
            font-size: 9px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 1000;
            font-weight: bold;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            pointer-events: auto;
        }

        .bibtex-error-icon::before {
            content: '!';
        }

        .bibtex-error-icon:hover {
            background: #ff7875;
            transform: scale(1.1);
        }

        .bibtex-popup {
            position: fixed;
            background: white;
            border: 1px solid #d9d9d9;
            border-radius: 6px;
            box-shadow: 0 6px 16px rgba(0,0,0,0.12);
            padding: 12px;
            z-index: 10000;
            max-width: 450px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 13px;
            display: none;
        }

        .bibtex-popup-header {
            font-weight: 600;
            color: #ff4d4f;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .bibtex-popup-body {
            margin-bottom: 12px;
            color: #262626;
            line-height: 1.4;
        }

        .bibtex-suggestion {
            background: #f6ffed;
            border-left: 3px solid #52c41a;
            padding: 8px;
            margin: 8px 0;
            font-family: monospace;
            font-size: 11px;
            white-space: pre-wrap;
            max-height: 150px;
            overflow-y: auto;
        }

        .bibtex-popup-actions {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        }

        .bibtex-btn {
            padding: 4px 12px;
            border: 1px solid #d9d9d9;
            border-radius: 4px;
            background: white;
            cursor: pointer;
            font-size: 12px;
        }

        .bibtex-btn-apply {
            background: #1890ff;
            color: white;
            border-color: #1890ff;
        }

        .bibtex-btn-apply:hover {
            background: #40a9ff;
        }

        .bibtex-btn:hover {
            border-color: #40a9ff;
        }

        .bibtex-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: 999;
        }
    `);

    class BibTeXChecker {
        constructor() {
            this.overlay = null;
            this.editor = null;
            this.errors = [];
            this.titleSimilarityThreshold = 0.3; // Minimum similarity threshold (0-1)
        }

        init() {
            this.createOverlay();
            this.watchForEditor();
        }
        // Ensure method separation with commas

        createOverlay() {
            this.overlay = document.createElement('div');
            this.overlay.className = 'bibtex-overlay';
            document.body.appendChild(this.overlay);
        }

        watchForEditor() {
            const observer = new MutationObserver(() => {
                // Find selected file in file tree
                const selectedFile = document.querySelector('li[aria-selected="true"][aria-label$=".bib"]');
                // Find editor for bibtex
                const editor = document.querySelector('.cm-content[contenteditable="true"][data-language="bibtex"]');
                if (selectedFile && editor && editor !== this.editor) {
                    this.editor = editor;
                    this.setupEditorWatcher();
                    this.checkBibTeX(); // Run BibTeX check immediately when editor loads
                } else if ((!selectedFile || !editor) && this.editor) {
                    // If bib file/editor is no longer selected, clear overlay and editor reference
                    this.editor = null;
                    this.clearErrors();
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // Manual check button (only visible when .bib file is selected)
            // Create a draggable, beautiful button in the left bottom
            const btn = document.createElement('button');
            btn.textContent = 'Check BibTeX';
            btn.setAttribute('id', 'bibtidy-check-btn');
            btn.style.cssText = `
                position:fixed;
                left:24px;
                bottom:24px;
                z-index:10000;
                background:linear-gradient(90deg,#1890ff 0%,#52c41a 100%);
                color:white;
                border:none;
                box-shadow:0 2px 8px rgba(0,0,0,0.15);
                padding:12px 28px;
                border-radius:24px;
                cursor:pointer;
                font-size:16px;
                font-weight:600;
                letter-spacing:0.5px;
                display:none;
                transition:box-shadow 0.2s,transform 0.2s;
            `;
            btn.onmouseenter = () => {
                btn.style.boxShadow = '0 4px 16px rgba(24,144,255,0.25)';
                btn.style.transform = 'scale(1.05)';
            };
            btn.onmouseleave = () => {
                btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                btn.style.transform = 'scale(1)';
            };
            btn.onclick = () => {
                const editor = document.querySelector('.cm-content[contenteditable="true"][data-language="bibtex"]');
                if (editor) {
                    this.editor = editor;
                    this.checkBibTeX();
                } else {
                    alert('Please select a .bib file in the file tree and open it in the editor.');
                }
            };
            document.body.appendChild(btn);

            // Make button draggable
            let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;
            btn.addEventListener('mousedown', function(e) {
                isDragging = true;
                dragOffsetX = e.clientX - btn.getBoundingClientRect().left;
                dragOffsetY = e.clientY - btn.getBoundingClientRect().top;
                btn.style.transition = 'none';
                document.body.style.userSelect = 'none';
            });
            document.addEventListener('mousemove', function(e) {
                if (isDragging) {
                    btn.style.left = (e.clientX - dragOffsetX) + 'px';
                    btn.style.top = (e.clientY - dragOffsetY) + 'px';
                    btn.style.bottom = 'auto';
                }
            });
            document.addEventListener('mouseup', function() {
                if (isDragging) {
                    isDragging = false;
                    btn.style.transition = 'box-shadow 0.2s,transform 0.2s';
                    document.body.style.userSelect = '';
                }
            });

            // Show/hide button based on .bib file selection
            const updateBtnVisibility = () => {
                const selectedFile = document.querySelector('li[aria-selected="true"][aria-label$=".bib"]');
                btn.style.display = selectedFile ? 'block' : 'none';
            };
            // Initial check
            updateBtnVisibility();
            // Observe file tree selection changes
            const fileTreeObserver = new MutationObserver(updateBtnVisibility);
            fileTreeObserver.observe(document.body, { childList: true, subtree: true });
        }

        setupEditorWatcher() {
            let timeout;
            this.editor.addEventListener('input', () => {
                clearTimeout(timeout);
                timeout = setTimeout(() => this.checkBibTeX(), 2000);
            });

            // Update error icon positions and check for new entries on scroll
            this.editor.parentElement.addEventListener('scroll', () => {
                this.updateErrorIconPositions();
                // Debounced check for new entries
                if (this._scrollCheckTimeout) clearTimeout(this._scrollCheckTimeout);
                this._scrollCheckTimeout = setTimeout(() => {
                    this.checkForNewEntriesOnScroll();
                }, 300);
            });
        }
        checkForNewEntriesOnScroll() {
            // Get current BibTeX entries
            const content = this.getEditorContent();
            const entries = this.parseBibTeX(content);
            // Get keys of entries already shown as errors
            const shownKeys = new Set(this.errors.map(e => e.entry.key));
            // Find new entries not yet shown
            const newEntries = entries.filter(e => !shownKeys.has(e.key));
            if (newEntries.length > 0) {
                // For each new entry, check DBLP and show error icon if needed
                newEntries.forEach(async entry => {
                    let issues = [];
                    let correctBibTeX = null;
                    if (entry.fields.title) {
                        try {
                            const dblpEntry = await this.searchDBLP(entry.fields.title);
                            if (dblpEntry) {
                                correctBibTeX = this.formatDBLPEntry(dblpEntry, entry.key);
                                issues = this.compareWithDBLP(entry, dblpEntry);
                            } else {
                                issues = this.validateEntry(entry);
                            }
                        } catch (error) {
                            issues = this.validateEntry(entry);
                        }
                    } else {
                        issues = this.validateEntry(entry);
                    }
                    if (issues.length > 0) {
                        this.showError(entry, issues, correctBibTeX);
                    }
                });
            }
        }

        updateErrorIconPositions() {
            if (!this.errors || !this.editor) return;
            this.errors.forEach(({ entry, icon }) => {
                const range = this.getEntryRange(entry);
                if (range) {
                    const rect = range.getBoundingClientRect();
                    icon.style.left = (rect.right + 5) + 'px';
                    icon.style.top = (rect.top + 2) + 'px';
                }
            });
        }

        getEditorContent() {
            if (!this.editor) return '';

            // Use innerText to preserve line breaks, or traverse DOM nodes
            const walker = document.createTreeWalker(
                this.editor,
                NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
                {
                    acceptNode: (node) => {
                        if (node.nodeType === Node.TEXT_NODE) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                        if (node.nodeName === 'BR' || node.nodeName === 'DIV') {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                        return NodeFilter.FILTER_SKIP;
                    }
                }
            );

            let content = '';
            let node;

            while (node = walker.nextNode()) {
                if (node.nodeType === Node.TEXT_NODE) {
                    content += node.textContent;
                } else if (node.nodeName === 'BR') {
                    content += '\n';
                } else if (node.nodeName === 'DIV' && content && !content.endsWith('\n')) {
                    content += '\n';
                }
            }

            return content;
        }

        setEditorContent(newContent) {
            if (!this.editor) return;

            // For CodeMirror editors, we need to set content properly
            // Try multiple approaches to ensure compatibility

            // Method 1: Direct textContent (may lose formatting)
            this.editor.textContent = newContent;

            // Method 2: Try to trigger CodeMirror updates if available
            if (this.editor.CodeMirror) {
                this.editor.CodeMirror.setValue(newContent);
            } else {
                // Method 3: Use innerText to preserve some formatting
                this.editor.innerText = newContent;
            }
        }

        async checkBibTeX() {
            if (!this.editor) return;

            const content = this.getEditorContent();
            if (!content.includes('@')) {
                this.clearErrors();
                return;
            }

            this.clearErrors();
            const entries = this.parseBibTeX(content);

            for (const entry of entries) {
                if (entry.fields.title) {
                    try {
                        const dblpEntry = await this.searchDBLP(entry.fields.title);
                        if (dblpEntry) {
                            const correctBibTeX = this.formatDBLPEntry(dblpEntry, entry.key);
                            const issues = this.compareWithDBLP(entry, dblpEntry);
                            if (issues.length > 0) {
                                this.showError(entry, issues, correctBibTeX);
                            }
                        } else {
                            const issues = this.validateEntry(entry);
                            if (issues.length > 0) {
                                this.showError(entry, issues);
                            }
                        }
                    } catch (error) {
                        const issues = this.validateEntry(entry);
                        if (issues.length > 0) {
                            this.showError(entry, issues);
                        }
                    }
                } else {
                    const issues = this.validateEntry(entry);
                    if (issues.length > 0) {
                        this.showError(entry, issues);
                    }
                }
            }
        }

        parseBibTeX(content) {
            const entries = [];
            const entryRegex = /@(\w+)\s*\{\s*([^,}]+)/g;
            let match;

            while ((match = entryRegex.exec(content)) !== null) {
                const type = match[1].toLowerCase();
                const key = match[2].trim();
                const startPos = match.index;

                // Find entry end
                let braces = 0;
                let endPos = startPos;
                let foundFirstBrace = false;

                for (let i = startPos; i < content.length; i++) {
                    if (content[i] === '{') {
                        braces++;
                        foundFirstBrace = true;
                    } else if (content[i] === '}') {
                        braces--;
                        if (foundFirstBrace && braces === 0) {
                            endPos = i;
                            break;
                        }
                    }
                }

                const entryText = content.substring(startPos, endPos + 1);
                const fields = this.parseFields(entryText);

                entries.push({
                    type,
                    key,
                    startPos,
                    endPos,
                    text: entryText,
                    fields
                });
            }

            return entries;
        }

        parseFields(entryText) {
            const fields = {};
            let i = 0;

            while (i < entryText.length) {
                // Find field name
                const fieldMatch = entryText.substring(i).match(/(\w+)\s*=\s*/);
                if (!fieldMatch) {
                    i++;
                    continue;
                }

                const fieldName = fieldMatch[1].toLowerCase();
                i += fieldMatch.index + fieldMatch[0].length;

                // Parse field value
                if (i < entryText.length && entryText[i] === '{') {
                    // Braced value - handle nested braces
                    let braceCount = 0;
                    let start = i;

                    while (i < entryText.length) {
                        if (entryText[i] === '{') braceCount++;
                        else if (entryText[i] === '}') braceCount--;
                        i++;
                        if (braceCount === 0) break;
                    }

                    const value = entryText.substring(start + 1, i - 1); // Remove outer braces
                    fields[fieldName] = value;
                } else {
                    // Unbraced value - read until comma or end
                    let start = i;
                    while (i < entryText.length && entryText[i] !== ',' && entryText[i] !== '}') {
                        i++;
                    }
                    const value = entryText.substring(start, i).trim();
                    fields[fieldName] = value;
                }
            }

            return fields;
        }

        calculateTitleSimilarity(title1, title2) {
            if (!title1 || !title2) return 0;

            // Normalize titles for comparison
            const normalize = (title) => title.toLowerCase()
                .replace(/[{}]/g, '')
                .replace(/[^\w\s]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            const norm1 = normalize(title1);
            const norm2 = normalize(title2);

            // Simple word-based similarity using Jaccard coefficient
            const words1 = new Set(norm1.split(' '));
            const words2 = new Set(norm2.split(' '));

            const intersection = new Set([...words1].filter(x => words2.has(x)));
            const union = new Set([...words1, ...words2]);

            return intersection.size / union.size;
        }

        cleanFieldValue(value) {
            if (!value) return '';

            return value
                .replace(/[\n\r\t]/g, ' ')  // Replace newlines, carriage returns, tabs with spaces
                .replace(/\s+/g, ' ')       // Replace multiple spaces with single space
                .trim();                    // Remove leading/trailing whitespace
        }

        async searchDBLP(title) {
            return new Promise((resolve) => {
                const query = encodeURIComponent(title.replace(/[{}]/g, ''));
                const url = `https://dblp.org/search/publ/api?q=${query}&format=bib&h=5`;

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    timeout: 5000,
                    onload: (response) => {
                        try {
                            if (response.status === 200) {
                                const bibText = response.responseText.trim();
                                if (bibText && bibText.includes('@')) {
                                    const entries = this.parseBibTeX(bibText);
                                    if (entries.length === 0) {
                                        resolve(null);
                                        return;
                                    }
                                    let bestEntry = null;
                                    let bestSimilarity = 0;
                                    for (const entry of entries) {
                                        if (entry.fields.title) {
                                            for (const [fieldName, fieldValue] of Object.entries(entry.fields)) {
                                                entry.fields[fieldName] = this.cleanFieldValue(fieldValue);
                                            }
                                            const similarity = this.calculateTitleSimilarity(title, entry.fields.title);
                                            if (similarity > bestSimilarity && similarity >= this.titleSimilarityThreshold) {
                                                bestSimilarity = similarity;
                                                bestEntry = entry;
                                            }
                                        }
                                    }
                                    resolve(bestEntry);
                                } else {
                                    resolve(null);
                                }
                            } else {
                                resolve(null);
                            }
                        } catch (e) {
                            resolve(null);
                        }
                    },
                    onerror: () => resolve(null),
                    ontimeout: () => resolve(null)
                });
            });
        }

        formatDBLPEntry(dblpEntry, originalKey) {
            let bibtex = `@${dblpEntry.type}{${originalKey},\n`;

            const fieldOrder = ['title', 'author', 'booktitle', 'journal', 'year', 'volume', 'pages', 'doi'];

            for (const field of fieldOrder) {
                if (dblpEntry.fields[field]) {
                    bibtex += `  ${field} = {${dblpEntry.fields[field]}},\n`;
                }
            }

            bibtex = bibtex.replace(/,\n$/, '\n');
            bibtex += '}';

            return bibtex;
        }

        compareWithDBLP(entry, dblpEntry) {
            const issues = [];

            // Compare key fields
            const fieldsToCheck = ['title', 'author', 'year', 'journal', 'booktitle'];

            for (const field of fieldsToCheck) {
                const originalValue = entry.fields[field];
                const dblpValue = dblpEntry.fields[field];

                if (dblpValue && (!originalValue ||
                    this.normalizeForComparison(originalValue) !== this.normalizeForComparison(dblpValue))) {

                    const originalDisplay = originalValue ? `"${originalValue}"` : "(missing)";
                    const dblpDisplay = `"${dblpValue}"`;
                    issues.push(`${field}: ${originalDisplay} → ${dblpDisplay}`);
                }
            }

            if (entry.type !== dblpEntry.type) {
                issues.push(`Entry type: ${entry.type} → ${dblpEntry.type}`);
            }

            return issues;
        }

        normalizeForComparison(value) {
            if (!value) return '';
            return value.toLowerCase()
                       .replace(/\s+/g, ' ')  // Replace all whitespace (including \n, \t) with single space
                       .trim();
        }

        validateEntry(entry) {
            const issues = [];

            if (!entry.fields.title || entry.fields.title.trim() === '') {
                issues.push('Missing title');
            }

            if (!entry.fields.author || entry.fields.author.trim() === '') {
                issues.push('Missing author');
            }

            if (!entry.fields.year || entry.fields.year.trim() === '') {
                issues.push('Missing year');
            }

            if (entry.type === 'article' && !entry.fields.journal) {
                issues.push('Missing journal for article');
            }

            if (entry.type === 'inproceedings' && !entry.fields.booktitle) {
                issues.push('Missing booktitle for conference paper');
            }

            return issues;
        }

        showError(entry, issues, correctBibTeX = null) {
            const range = this.getEntryRange(entry);
            if (!range) return;

            const rect = range.getBoundingClientRect();

            const icon = document.createElement('div');
            icon.className = 'bibtex-error-icon';
            icon.style.position = 'fixed';
            icon.style.left = (rect.right + 5) + 'px';
            icon.style.top = (rect.top + 2) + 'px';
            icon.style.pointerEvents = 'auto';

            icon.onclick = (e) => {
                e.stopPropagation();
                this.showPopup(entry, issues, icon, correctBibTeX);
            };

            this.overlay.appendChild(icon);
            this.errors.push({ entry, icon, issues, correctBibTeX });
        }

        getEntryRange(entry) {
            const walker = document.createTreeWalker(
                this.editor,
                NodeFilter.SHOW_TEXT
            );

            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.includes(entry.key)) {
                    const range = document.createRange();
                    range.selectNode(node);
                    return range;
                }
            }
            return null;
        }

        showPopup(entry, issues, icon, correctBibTeX = null) {
            document.querySelectorAll('.bibtex-popup').forEach(p => p.remove());

            const popup = document.createElement('div');
            popup.className = 'bibtex-popup';


            // Diff-style highlight for issues
            function diffHighlight(issue) {
                // Try to parse: field: "old" → "new"
                const match = issue.match(/^(\w+): (".*?") → (".*?")$/);
                if (match) {
                    const field = match[1];
                    const oldVal = match[2];
                    const newVal = match[3];
                    return `<li style="font-family:monospace;white-space:pre-wrap;"><span style="color:#d32f2f;background:#ffeaea;padding:2px 4px;border-radius:3px;">- ${field}: ${oldVal}</span><br><span style="color:#388e3c;background:#eaffea;padding:2px 4px;border-radius:3px;">+ ${field}: ${newVal}</span></li>`;
                }
                // Entry type change
                const typeMatch = issue.match(/^Entry type: (\w+) → (\w+)$/);
                if (typeMatch) {
                    return `<li style="font-family:monospace;white-space:pre-wrap;"><span style="color:#d32f2f;background:#ffeaea;padding:2px 4px;border-radius:3px;">- type: ${typeMatch[1]}</span><br><span style="color:#388e3c;background:#eaffea;padding:2px 4px;border-radius:3px;">+ type: ${typeMatch[2]}</span></li>`;
                }
                // Missing field
                if (issue.startsWith('Missing')) {
                    return `<li style="font-family:monospace;white-space:pre-wrap;"><span style="color:#d32f2f;background:#ffeaea;padding:2px 4px;border-radius:3px;">- ${issue}</span></li>`;
                }
                // Default
                return `<li>${issue}</li>`;
            }

            let suggestionHtml = '';
            if (correctBibTeX) {
                suggestionHtml = `
                    <div class="bibtex-suggestion">${correctBibTeX}</div>
                `;
            }

            popup.innerHTML = `
                <div class="bibtex-popup-header">
                    <span>${correctBibTeX ? '🔍' : '⚠️'}</span>
                    ${correctBibTeX ? 'DBLP Correction Available' : 'BibTeX Issues Found'}
                </div>
                <div class="bibtex-popup-body">
                    <strong>Entry "${entry.key}" ${correctBibTeX ? 'differs from DBLP:' : 'has issues:'}</strong>
                    <ul style="margin: 4px 0; padding-left: 16px;">
                        ${issues.map(diffHighlight).join('')}
                    </ul>
                    ${suggestionHtml}
                </div>
                <div class="bibtex-popup-actions">
                    <button class="bibtex-btn" onclick="this.parentElement.parentElement.remove()">
                        Dismiss
                    </button>
                    ${correctBibTeX ?
                        `<button class="bibtex-btn bibtex-btn-apply" data-entry-key="${entry.key}">
                            Apply DBLP Fix
                        </button>` :
                        `<button class="bibtex-btn" onclick="alert('No DBLP correction available')">
                            No Fix Available
                        </button>`
                    }
                </div>
            `;

            document.body.appendChild(popup);

            // Add event listener for the apply button
            const applyBtn = popup.querySelector('.bibtex-btn-apply');
            if (applyBtn) {
                applyBtn.addEventListener('click', () => {
                    const entryKey = applyBtn.getAttribute('data-entry-key');
                    this.applyCorrection(entryKey);
                });
            }

            const iconRect = icon.getBoundingClientRect();
            popup.style.left = (iconRect.right + 10) + 'px';
            popup.style.top = iconRect.top + 'px';
            popup.style.display = 'block';

            setTimeout(() => {
                if (popup.parentElement) popup.remove();
            }, 15000);

            setTimeout(() => {
                const hidePopup = (e) => {
                    if (!popup.contains(e.target) && !icon.contains(e.target)) {
                        popup.remove();
                        document.removeEventListener('click', hidePopup);
                    }
                };
                document.addEventListener('click', hidePopup);
            }, 100);
        }

        applyCorrection(entryKey) {
            const errorData = this.errors.find(e => e.entry.key === entryKey);
            if (!errorData || !errorData.correctBibTeX) return;
            const content = this.getEditorContent();
            const newContent = content.replace(errorData.entry.text, errorData.correctBibTeX);
            this.setEditorContent(newContent);
            const inputEvent = new Event('input', { bubbles: true });
            const changeEvent = new Event('change', { bubbles: true });
            this.editor.dispatchEvent(inputEvent);
            this.editor.dispatchEvent(changeEvent);
            document.querySelectorAll('.bibtex-popup').forEach(p => p.remove());
            this.checkBibTeX();
        }

        clearErrors() {
            if (this.overlay) {
                this.overlay.innerHTML = '';
            }
            this.errors = [];
            document.querySelectorAll('.bibtex-popup').forEach(p => p.remove());
        }
    }

    // Initialize
    const checker = new BibTeXChecker();
    window.bibTeXChecker = checker; // Make globally accessible

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => checker.init());
    } else {
        checker.init();
    }

})();