var Tokenizer = require('./tokenizer').Tokenizer,
    OpenElementStack = require('./open_element_stack').OpenElementStack,
    FormattingElementList = require('./formatting_element_list').FormattingElementList,
    defaultTreeBuilder = require('./default_tree_builder'),
    html = require('./html'),
    idioms = require('./idioms');

//Aliases
var $ = html.TAG_NAMES;

//Insertion modes
var INITIAL_MODE = 'INITIAL_MODE',
    BEFORE_HTML_MODE = 'BEFORE_HTML_MODE',
    BEFORE_HEAD_MODE = 'BEFORE_HEAD_MODE',
    IN_HEAD_MODE = 'IN_HEAD_MODE',
    AFTER_HEAD_MODE = 'AFTER_HEAD_MODE',
    IN_BODY_MODE = 'IN_BODY_MODE',
    TEXT_MODE = 'TEXT_MODE',
    IN_TABLE_MODE = 'IN_TABLE_MODE',
    IN_TABLE_TEXT_MODE = 'IN_TABLE_TEXT_MODE',
    IN_CAPTION_MODE = 'IN_CAPTION_MODE',
    IN_COLUMN_GROUP_MODE = 'IN_COLUMN_GROUP_MODE',
    IN_TABLE_BODY_MODE = 'IN_TABLE_BODY_MODE',
    IN_ROW_MODE = 'IN_ROW_MODE',
    IN_CELL_MODE = 'IN_CELL_MODE',
    IN_SELECT_MODE = 'IN_SELECT_MODE',
    IN_SELECT_IN_TABLE_MODE = 'IN_SELECT_IN_TABLE_MODE',
    AFTER_BODY_MODE = 'AFTER_BODY_MODE',
    IN_FRAMESET_MODE = 'IN_FRAMESET_MODE',
    AFTER_FRAMESET_MODE = 'AFTER_FRAMESET_MODE',
    AFTER_AFTER_BODY_MODE = 'AFTER_AFTER_BODY_MODE',
    AFTER_AFTER_FRAMESET_MODE = 'AFTER_AFTER_FRAMESET_MODE';

//Insertion mode token handlers aliases
var _ = {};

_[INITIAL_MODE] = {};
_[INITIAL_MODE][Tokenizer.CHARACTER_TOKEN] = characterInInitialMode;
_[INITIAL_MODE][Tokenizer.COMMENT_TOKEN] = commentInInitialMode;
_[INITIAL_MODE][Tokenizer.DOCTYPE_TOKEN] = doctypeInInitialMode;
_[INITIAL_MODE][Tokenizer.START_TAG_TOKEN] =
_[INITIAL_MODE][Tokenizer.END_TAG_TOKEN] =
_[INITIAL_MODE][Tokenizer.EOF_TOKEN] = initialModeDefaultEntry;

_[BEFORE_HTML_MODE] = {};
_[BEFORE_HTML_MODE][Tokenizer.CHARACTER_TOKEN] = characterBeforeHtml;
_[BEFORE_HTML_MODE][Tokenizer.COMMENT_TOKEN] = commentBeforeHtml;
_[BEFORE_HTML_MODE][Tokenizer.DOCTYPE_TOKEN] = doctypeBeforeHtml;
_[BEFORE_HTML_MODE][Tokenizer.START_TAG_TOKEN] = startTagBeforeHtml;
_[BEFORE_HTML_MODE][Tokenizer.END_TAG_TOKEN] = endTagBeforeHtml;
_[BEFORE_HTML_MODE][Tokenizer.EOF_TOKEN] = beforeHtmlModeDefaultEntry;

_[BEFORE_HEAD_MODE] = {};
_[BEFORE_HEAD_MODE][Tokenizer.CHARACTER_TOKEN] = characterBeforeHead;
_[BEFORE_HEAD_MODE][Tokenizer.COMMENT_TOKEN] = commentBeforeHead;
_[BEFORE_HEAD_MODE][Tokenizer.DOCTYPE_TOKEN] = doctypeBeforeHead;
_[BEFORE_HEAD_MODE][Tokenizer.START_TAG_TOKEN] = startTagBeforeHead;
_[BEFORE_HEAD_MODE][Tokenizer.END_TAG_TOKEN] = endTagBeforeHead;
_[BEFORE_HEAD_MODE][Tokenizer.EOF_TOKEN] = beforeHeadModeDefaultEntry;

_[IN_HEAD_MODE] = {};
_[IN_HEAD_MODE][Tokenizer.CHARACTER_TOKEN] = characterInHead;
_[IN_HEAD_MODE][Tokenizer.COMMENT_TOKEN] = commentInHead;
_[IN_HEAD_MODE][Tokenizer.DOCTYPE_TOKEN] = doctypeInHead;
_[IN_HEAD_MODE][Tokenizer.START_TAG_TOKEN] = startTagInHead;
_[IN_HEAD_MODE][Tokenizer.END_TAG_TOKEN] = endTagInHead;
_[IN_HEAD_MODE][Tokenizer.EOF_TOKEN] = inHeadModeDefaultEntry;

_[AFTER_HEAD_MODE] = {};
_[AFTER_HEAD_MODE][Tokenizer.CHARACTER_TOKEN] = characterAfterHead;
_[AFTER_HEAD_MODE][Tokenizer.COMMENT_TOKEN] = commentAfterHead;
_[AFTER_HEAD_MODE][Tokenizer.DOCTYPE_TOKEN] = doctypeAfterHead;
_[AFTER_HEAD_MODE][Tokenizer.START_TAG_TOKEN] = startTagAfterHead;
_[AFTER_HEAD_MODE][Tokenizer.END_TAG_TOKEN] = endTagAfterHead;
_[AFTER_HEAD_MODE][Tokenizer.EOF_TOKEN] = afterHeadModeDefaultEntry;

//Utils
function isWhitespaceCharacter(ch) {
    return ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r' || ch === '\f';
}

function isSpecialElement(element) {
    var ns = idioms.SCOPING_ELEMENTS[element.tagName];

    return ns && ns.indexOf(element.namespaceURI) > -1;
}

function getTokenAttr(token, attrName) {
    for (var i = token.attrs.length - 1; i >= 0; i--) {
        if (token.attrs[i].name === attrName)
            return token.attrs[i].value;
    }

    return null;
}

//12.2.5.4.1 The "initial" insertion mode
//------------------------------------------------------------------
function characterInInitialMode(p, token) {
    if (!isWhitespaceCharacter(token.ch))
        initialModeDefaultEntry(p, token);
}

function commentInInitialMode(p, token) {
    p._appendCommentNode(token)
}

function doctypeInInitialMode(p, token) {
    //TODO
}

function initialModeDefaultEntry(p, token) {
    p._err('Parse error');
    p.document.quirksMode = true;
    p.insertionMode = BEFORE_HTML_MODE;
    p._processToken(token);
}


//12.2.5.4.2 The "before html" insertion mode
//------------------------------------------------------------------
function characterBeforeHtml(p, token) {
    if (!isWhitespaceCharacter(token.ch))
        beforeHtmlModeDefaultEntry(p, token);
}

function commentBeforeHtml(p, token) {
    p._appendCommentNode(token);
}

function doctypeBeforeHtml(p, token) {
    p._err('Parse error');
}

function startTagBeforeHtml(p, token) {
    if (token.tagName === $.HTML) {
        p._insertElementForToken(token);
        p.insertionMode = BEFORE_HEAD_MODE;
    }

    else
        beforeHtmlModeDefaultEntry(p, token);
}

function endTagBeforeHtml(p, token) {
    var tn = token.tagName;

    if (tn === $.HTML || tn === $.HEAD || tn === $.BODY || tn === $.BR)
        beforeHtmlModeDefaultEntry(p, token);

    else
        p._err('Parse error');
}

function beforeHtmlModeDefaultEntry(p, token) {
    p._explicitlyCreateElementAndInsert($.HTML);
    p.insertionMode = BEFORE_HEAD_MODE;
    p._processToken(token);
}


//12.2.5.4.3 The "before head" insertion mode
//------------------------------------------------------------------
function characterBeforeHead(p, token) {
    if (!isWhitespaceCharacter(token.ch))
        beforeHeadModeDefaultEntry(p, token);
}

function commentBeforeHead(p, token) {
    p._appendCommentNode(token);
}

function doctypeBeforeHead(p, token) {
    p._err('Parse error');
}

function startTagBeforeHead(p, token) {
    var tn = token.tagName;

    if (tn === $.HTML)
        startTagInBody(p, token);

    else if (tn === $.HEAD) {
        p._insertElementForToken(token);
        p.headElement = p.openElements.current;
        p.insertionMode = IN_HEAD_MODE;
    }

    else
        beforeHeadModeDefaultEntry(p, token);
}

function endTagBeforeHead(p, token) {
    var tn = token.tagName;

    if (tn === $.HEAD || tn === $.BODY || tn === $.HTML || tn === $.BR)
        beforeHeadModeDefaultEntry(p, token);

    else
        p._err('Parse error');
}

function beforeHeadModeDefaultEntry(p, token) {
    p._processFakeStartTag($.HEAD);
    p._processToken(token);
}


//12.2.5.4.4 The "in head" insertion mode
//------------------------------------------------------------------
function characterInHead(p, token) {
    if (isWhitespaceCharacter(token.ch))
        p._insertCharacter(token);

    else
        inHeadModeDefaultEntry(p, token);
}

function commentInHead(p, token) {
    p._appendCommentNode(token);
}

function doctypeInHead(p, token) {
    p._err('Parse error');
}

function startTagInHead(p, token) {
    var tn = token.tagName;

    if (tn === $.HTML)
        startTagInBody(p, token);

    else if (tn === $.BASE || tn === $.BASEFONT || tn === $.BGSOUND || tn === $.LINK || tn === $.META)
        p._appendElementForToken(token);

    else if (tn === $.TITLE)
        p._parseTextElement(token, Tokenizer.RCDATA_STATE);

    //NOTE: here we assume that we always act as an interactive user agent with enabled scripting, so we parse
    //<noscript> as a rawtext.
    else if (tn === $.NOSCRIPT || tn === $.NOFRAMES || tn === $.STYLE)
        p._parseTextElement(token, Tokenizer.RAWTEXT_STATE);

    else if (tn === $.SCRIPT) {
        p._insertElementForToken(token);
        p.tokenizer.state = Tokenizer.SCRIPT_DATA_STATE;
        p.originalInsertionMode = IN_HEAD_MODE;
        p.insertionMode = TEXT_MODE;
    }

    else if (tn === $.HEAD)
        p._err('Parsing error');

    else
        inHeadModeDefaultEntry(p, token);
}

function endTagInHead(p, token) {
    var tn = token.tagName;

    if (tn === $.HEAD) {
        p.openElements.pop();
        p.insertionMode = AFTER_HEAD_MODE;
    }

    else if (tn === $.BODY || tn === $.BR || tn === $.HTML)
        inHeadModeDefaultEntry(p, token);

    else
        p._err('Parse error');
}

function inHeadModeDefaultEntry(p, token) {
    p._processFakeEndTag($.HEAD);
    p._processToken(token);
}


//12.2.5.4.6 The "after head" insertion mode
//------------------------------------------------------------------
function characterAfterHead(p, token) {
    if (isWhitespaceCharacter(token.ch))
        p._insertCharacter(token);
    else
        afterHeadModeDefaultEntry(p, token);
}

function commentAfterHead(p, token) {
    p._appendCommentNode(token);
}

function doctypeAfterHead(p, token) {
    p._err('Parse error');
}

function startTagAfterHead(p, token) {
    var tn = token.tagName;

    if (tn === $.HTML)
        startTagInBody(p, token);

    else if (tn === $.BODY) {
        p._insertElementForToken(token);
        p.framesetOk = false;
        p.insertionMode = IN_BODY_MODE;
    }

    else if (tn === $.FRAMESET) {
        p._insertElementForToken(token);
        p.insertionMode = IN_FRAMESET_MODE;
    }

    else if (tn === $.BASE || tn === $.BASEFONT || tn === $.BGSOUND || tn === $.LINK || tn === $.META ||
             tn === $.NOFRAMES || tn === $.SCRIPT || tn === $.STYLE || tn === $.TITLE) {
        p.openElements.push(p.headElement);
        startTagInHead(p, token);
        p.openElements.remove(p.headElement);
    }

    else if (tn === $.HEAD)
        p._err('Parse error');

    else
        afterHeadModeDefaultEntry(p, token);
}

function endTagAfterHead(p, token) {
    var tn = token.tagName;

    if (tn === $.BODY || tn === $.HTML || tn === $.BR)
        afterHeadModeDefaultEntry(p, token);
    else
        p._err('Parse error');
}

function afterHeadModeDefaultEntry(p, token) {
    p._processFakeStartTag($.BODY);
    p._processToken(token);
}


//12.2.5.4.7 The "in body" insertion mode
//------------------------------------------------------------------
function characterInBody(p, token) {
    if (token.ch === '\u0000')
        p._err('Parse error');

    else {
        p._reconstructActiveFormattingElements();
        p._insertCharacter(token);

        if (!isWhitespaceCharacter(token.ch))
            p.framesetOk = false;
    }
}

function commentInBody(p, token) {
    p._appendCommentNode(token);
}

function doctypeInBody(p, token) {
    p._err('Parse error');
}

//Start tag in body handlers
var startTagInBodyHandlers = {};

startTagInBodyHandlers[$.HTML] = function (p, token) {
    p._err('Parse error');
    p.treeBuilder.adoptAttributes(p.openElements.current, token.attrs);
};

startTagInBodyHandlers[$.BASE] =
startTagInBodyHandlers[$.BASEFONT] =
startTagInBodyHandlers[$.BGSOUND] =
startTagInBodyHandlers[$.LINK] =
startTagInBodyHandlers[$.MENUITEM] =
startTagInBodyHandlers[$.META] =
startTagInBodyHandlers[$.SCRIPT] =
startTagInBodyHandlers[$.STYLE] =
startTagInBodyHandlers[$.TITLE] = startTagInHead;

startTagInBodyHandlers[$.BODY] = function (p, token) {
    p._err('Parse error');

    var bodyElement = p.openElements.tryPeekProperlyNestedBodyElement();

    if (bodyElement) {
        p.framesetOk = false;
        p.treeBuilder.adoptAttributes(bodyElement, token.attrs);
    }
};

startTagInBodyHandlers[$.FRAMESET] = function (p, token) {
    p._err('Parse error');

    if (p.openElements.tryPeekProperlyNestedBodyElement()) {
        p.treeBuilder.detachNode(p.openElements.current);
        p.openElements.popAllUpToHtmlElement();
        p._insertElementForToken(token);
        p.insertionMode = IN_FRAMESET_MODE;
    }
};

startTagInBodyHandlers[$.ADDRESS] =
startTagInBodyHandlers[$.ARTICLE] =
startTagInBodyHandlers[$.ASIDE] =
startTagInBodyHandlers[$.BLOCKQUOTE] =
startTagInBodyHandlers[$.CENTER] =
startTagInBodyHandlers[$.DETAILS] =
startTagInBodyHandlers[$.DIR] =
startTagInBodyHandlers[$.DIV] =
startTagInBodyHandlers[$.DL] =
startTagInBodyHandlers[$.FIELDSET] =
startTagInBodyHandlers[$.FIGCAPTION] =
startTagInBodyHandlers[$.FIGURE] =
startTagInBodyHandlers[$.FOOTER] =
startTagInBodyHandlers[$.HEADER] =
startTagInBodyHandlers[$.HGROUP] =
startTagInBodyHandlers[$.MAIN] =
startTagInBodyHandlers[$.MENU] =
startTagInBodyHandlers[$.NAV] =
startTagInBodyHandlers[$.OL] =
startTagInBodyHandlers[$.P] =
startTagInBodyHandlers[$.SECTION] =
startTagInBodyHandlers[$.SUMMARY] =
startTagInBodyHandlers[$.UL] = function (p, token) {
    if (p.openElements.hasInButtonScope($.P))
        p._processFakeEndTag($.P);

    p._insertElementForToken(token);
};

startTagInBodyHandlers[$.H1] =
startTagInBodyHandlers[$.H2] =
startTagInBodyHandlers[$.H3] =
startTagInBodyHandlers[$.H4] =
startTagInBodyHandlers[$.H5] =
startTagInBodyHandlers[$.H6] = function (p, token) {
    if (p.openElements.hasInButtonScope($.P))
        p._processFakeEndTag($.P);

    var tn = p.openElements.current.tagName;

    if (tn === $.H1 || tn === $.H2 || tn === $.H3 || tn === $.H4 || tn === $.H5 || tn === $.H6) {
        p._err('Parse error');
        p.openElements.pop();
    }

    p._insertElementForToken(token);
};

startTagInBodyHandlers[$.PRE] =
startTagInBodyHandlers[$.LISTING] = function (p, token) {
    if (p.openElements.hasInButtonScope($.P))
        p._processFakeEndTag($.P);

    p._insertElementForToken(token);

    //TODO If the next token is a U+000A LINE FEED (LF) character token, then ignore that token and move on to the next one. (Newlines at the start of pre blocks are ignored as an authoring convenience.)
    p.framesetOk = false;
};

startTagInBodyHandlers[$.FORM] = function (p, token) {
    if (p.formElement)
        p._err('Parse error');

    else {
        if (p.openElements.hasInButtonScope($.P))
            p._processFakeEndTag($.P);

        p._insertElementForToken(token);
        p.formElement = p.openElements.current;
    }
};

startTagInBodyHandlers[$.LI] =
startTagInBodyHandlers[$.DD] =
startTagInBodyHandlers[$.DT] = function (p, token) {
    p.framesetOk = false;

    for (var i = p.openElements.stackTop; i >= 0; i--) {
        var element = p.openElements.stack[i],
            tn = element.tagName;

        if (tn !== $.ADDRESS && tn !== $.DIV && tn !== $.P && isSpecialElement(element))
            break;

        if ((token.tagName === $.LI && tn === $.LI) ||
            ((token.tagName === $.DD || token.tagName === $.DT) && (tn === $.DD || tn == $.DT))) {
            p._processFakeEndTag(token.tagName);
            break;
        }
    }

    if (p.openElements.hasInButtonScope($.P))
        p._processFakeEndTag($.P);

    p._insertElementForToken(token);
};

startTagInBodyHandlers[$.PLAINTEXT] = function (p, token) {
    if (p.openElements.hasInButtonScope($.P))
        p._processFakeEndTag($.P);

    p._insertElementForToken(token);
    p.tokenizer.state = Tokenizer.PLAINTEXT_STATE;
};

startTagInBodyHandlers[$.BUTTON] = function (p, token) {
    if (p.openElements.hasInScope($.BUTTON)) {
        p._err('Parse error');
        p._processFakeEndTag($.BUTTON);
        startTagInBodyHandlers[$.BUTTON](p, token);
    }

    else {
        p._reconstructActiveFormattingElements();
        p._insertElementForToken(token);
        p.framesetOk = false;
    }
};

startTagInBodyHandlers[$.A] = function (p, token) {
    //TODO
};

startTagInBodyHandlers[$.B] =
startTagInBodyHandlers[$.BIG] =
startTagInBodyHandlers[$.CODE] =
startTagInBodyHandlers[$.EM] =
startTagInBodyHandlers[$.FONT] =
startTagInBodyHandlers[$.I] =
startTagInBodyHandlers[$.S] =
startTagInBodyHandlers[$.SMALL] =
startTagInBodyHandlers[$.STRIKE] =
startTagInBodyHandlers[$.STRONG] =
startTagInBodyHandlers[$.TT] =
startTagInBodyHandlers[$.U] = function (p, token) {
    p._reconstructActiveFormattingElements();
    p._insertElementForToken(token);
    p.activeFormattingElements.push(p.openElements.current, token);
};

startTagInBodyHandlers[$.NOBR] = function (p, token) {
    p._reconstructActiveFormattingElements();

    if (p.openElements.hasInScope($.NOBR)) {
        p._err('Parse error');
        p._processFakeEndTag($.NOBR);
        p._reconstructActiveFormattingElements();
    }

    p._insertElementForToken(token);
    p.activeFormattingElements.push(p.openElements.current, token);
};

startTagInBodyHandlers[$.APPLET] =
startTagInBodyHandlers[$.MARQUEE] =
startTagInBodyHandlers[$.OBJECT] = function (p, token) {
    p._reconstructActiveFormattingElements();
    p._insertElementForToken(token);
    p.activeFormattingElements.insertMarker();
    p.framesetOk = false;
};

startTagInBodyHandlers[$.TABLE] = function (p, token) {
    if (!p.document.quirksMode && p.openElements.hasInButtonScope($.P))
        p._processFakeEndTag($.P);

    p._insertElementForToken(token);
    p.framesetOk = false;
    p.insertionMode = IN_TABLE_MODE;
};

startTagInBodyHandlers[$.AREA] =
startTagInBodyHandlers[$.BR] =
startTagInBodyHandlers[$.EMBED] =
startTagInBodyHandlers[$.IMG] =
startTagInBodyHandlers[$.KEYGEN] =
startTagInBodyHandlers[$.WBR] = function (p, token) {
    p._reconstructActiveFormattingElements();
    p._appendElementForToken(token);
    p.framesetOk = false;
};

startTagInBodyHandlers[$.INPUT] = function (p, token) {
    p._reconstructActiveFormattingElements();
    p._appendElementForToken(token);

    if (getTokenAttr(token, html.TYPE_ATTR).toLowerCase() === html.TYPE_ATTR_HIDDEN_VALUE)
        p.framesetOk = false;

};

startTagInBodyHandlers[$.PARAM] =
startTagInBodyHandlers[$.SOURCE] =
startTagInBodyHandlers[$.TRACK] = function (p, token) {
    p._appendElementForToken(token);
};

startTagInBodyHandlers[$.HR] = function (p, token) {
    if (p.openElements.hasInButtonScope($.P))
        p._processFakeEndTag($.P);

    p._appendElementForToken(token);
    p.framesetOk = false;
};

startTagInBodyHandlers[$.IMAGE] = function (p, token) {
    p._err('Parse error');
    token.tagName = $.IMG;
    startTagInBodyHandlers[$.IMG](p, token);
};

startTagInBodyHandlers[$.ISINDEX] = function (p, token) {
    //TODO
};

startTagInBodyHandlers[$.TEXTAREA] = function (p, token) {
    p._insertElementForToken(token);
    //TODO If the next token is a U+000A LINE FEED (LF) character token, then ignore that token and move on to the next one. (Newlines at the start of textarea elements are ignored as an authoring convenience.)
    p.tokenizer.state = Tokenizer.RCDATA_STATE;
    p.originalInsertionMode = p.insertionMode;
    p.framesetOk = false;
    p.insertionMode = TEXT_MODE;
};

startTagInBodyHandlers[$.XMP] = function (p, token) {
    if (p.openElements.hasInButtonScope($.P))
        p._processFakeEndTag($.P);

    p._reconstructActiveFormattingElements();
    p.framesetOk = false;
    p._parseTextElement(token, Tokenizer.RAWTEXT_STATE);
};

startTagInBodyHandlers[$.IFRAME] = function (p, token) {
    p.framesetOk = false;
    p._parseTextElement(token, Tokenizer.RAWTEXT_STATE);
};

//NOTE: here we assume that we always act as an interactive user agent with enabled scripting, so we parse
//<noscript> as a rawtext.
startTagInBodyHandlers[$.NOEMBED] =
startTagInBodyHandlers[$.NOSCRIPT] = function (p, token) {
    p._parseTextElement(token, Tokenizer.RAWTEXT_STATE);
};

startTagInBodyHandlers[$.SELECT] = function (p, token) {
    p._reconstructActiveFormattingElements();
    p._insertElementForToken(token);
    p.framesetOk = false;

    if (p.insertionMode === IN_TABLE_MODE || p.insertionMode === IN_CAPTION_MODE ||
        p.insertionMode === IN_TABLE_BODY_MODE || p.insertionMode === IN_ROW_MODE ||
        p.insertionMode === IN_CELL_MODE) {
        p.insertionMode = IN_SELECT_IN_TABLE_MODE;
    }

    else
        p.insertionMode = IN_SELECT_MODE;
};

startTagInBodyHandlers[$.OPTGROUP] =
startTagInBodyHandlers[$.OPTION] = function (p, token) {
    if (p.openElements.current.tagName === $.OPTION)
        p._processFakeEndTag($.OPTION);

    p._reconstructActiveFormattingElements();
    p._insertElementForToken(token);
};

startTagInBodyHandlers[$.RP] =
startTagInBodyHandlers[$.RT] = function (p, token) {
    if (p.openElements.hasInScope($.RUBY)) {
        p._generateImpliedEndTags();

        if (p.openElements.current.tagName !== $.RUBY)
            p._err('Parse error');
    }

    p._insertElementForToken(token);
};

startTagInBodyHandlers[$.MATH] = function (p, token) {
    //TODO
};

startTagInBodyHandlers[$.SVG] = function (p, token) {
    //TODO
};

startTagInBodyHandlers[$.CAPTION] =
startTagInBodyHandlers[$.COL] =
startTagInBodyHandlers[$.COLGROUP] =
startTagInBodyHandlers[$.FRAME] =
startTagInBodyHandlers[$.HEAD] =
startTagInBodyHandlers[$.TBODY] =
startTagInBodyHandlers[$.TD] =
startTagInBodyHandlers[$.TFOOT] =
startTagInBodyHandlers[$.TH] =
startTagInBodyHandlers[$.THEAD] =
startTagInBodyHandlers[$.TR] = function (p, token) {
    p._err('Parse error');
};

function startTagInBody(p, token) {
    var tn = token.tagName;

    if (startTagInBodyHandlers[tn])
        startTagInBodyHandlers[tn](p, token);
    else {
        p._reconstructActiveFormattingElements();
        p._insertElementForToken(token);
    }
}

//End tag in body
var endTagInBodyHandlers = {};

endTagInBodyHandlers[$.BODY] = function (p, token) {
    var ignoreToken = false;

    if (!p.openElements.hasInScope($.BODY)) {
        p._err('Parse error');
        ignoreToken = true;
    } else {
        for (var i = p.openElements.stackTop; i >= 0; i--) {
            var tn = p.openElements.stack[i].tagName;

            if (tn !== $.DD || tn !== $.DT || tn !== $.LI || tn !== $.OPTGROUP || tn !== $.OPTION ||
                tn !== $.P || tn !== $.RP || tn !== $.RT || tn !== $.TBODY || tn !== $.TD || tn !== $.TFOOT ||
                tn !== $.TH || tn !== $.THEAD || tn !== $.TR || tn !== $.BODY || tn !== $.HTML) {
                p._err('Parse error');
                break;
            }
        }

        p.insertionMode = AFTER_BODY_MODE;
    }

    return ignoreToken;
};

endTagInBodyHandlers[$.HTML] = function (p, token) {
    //NOTE: here we assume that </body> tag handler is not dealing with the token itself,
    //so we don't generate fake token here and just pass current token as argument
    //(which is actually is not a </body> tag).
    if (endTagInBodyHandlers[$.BODY](p, token))
        p._processToken(token);
};

endTagInBodyHandlers[$.ADDRESS] =
endTagInBodyHandlers[$.ARTICLE] =
endTagInBodyHandlers[$.ASIDE] =
endTagInBodyHandlers[$.BLOCKQUOTE] =
endTagInBodyHandlers[$.CENTER] =
endTagInBodyHandlers[$.DETAILS] =
endTagInBodyHandlers[$.DIR] =
endTagInBodyHandlers[$.DIV] =
endTagInBodyHandlers[$.DL] =
endTagInBodyHandlers[$.FIELDSET] =
endTagInBodyHandlers[$.FIGCAPTION] =
endTagInBodyHandlers[$.FIGURE] =
endTagInBodyHandlers[$.FOOTER] =
endTagInBodyHandlers[$.HEADER] =
endTagInBodyHandlers[$.HGROUP] =
endTagInBodyHandlers[$.MAIN] =
endTagInBodyHandlers[$.MENU] =
endTagInBodyHandlers[$.NAV] =
endTagInBodyHandlers[$.OL] =
endTagInBodyHandlers[$.P] =
endTagInBodyHandlers[$.SECTION] =
endTagInBodyHandlers[$.SUMMARY] =
endTagInBodyHandlers[$.UL] = function (p, token) {
    if (p.openElements.hasInScope(token.tagName)) {
        p._generateImpliedEndTags();

        if (p.openElements.current.tagName !== token.tagName)
            p._err('Parse error');

        while (p.openElements.current) {
            var poppedElement = p.openElements.current;

            p.openElements.pop();

            if (poppedElement.tagName === token.tagName)
                break;
        }
    } else
        p._err('Parse error');
};

endTagInBodyHandlers[$.FORM] = function (p, token) {
    var formElement = p.formElement;

    p.formElement = null;

    if (formElement && p.openElements.hasInScope($.FORM)) {
        p._generateImpliedEndTags();

        if (p.openElements.current !== formElement)
            p._err('Parse error');

        p.openElements.remove(formElement);
    }

    else
        p._err('Parse error');
};

//Parser
var Parser = exports.Parser = function (html, treeBuilder) {
    this.tokenizer = new Tokenizer(html);
    this.treeBuilder = treeBuilder || defaultTreeBuilder;
    this.errBuff = [];

    this.insertionMode = INITIAL_MODE;
    this.originalInsertionMode = '';

    this.document = this.treeBuilder.createDocument();
    this.headElement = null;
    this.formElement = null;
    this.openElements = new OpenElementStack(this.document);
    this.activeFormattingElements = new FormattingElementList();

    this.framesetOk = true;
};

Parser.prototype._err = function (msg) {
    this.errBuff.push(msg);
};

//Create element for token
Parser.prototype._createElementForToken = function (token, selfClosingAcknowledged) {
    if (token.selfClosing && !selfClosingAcknowledged)
        this._err('Parse error');

    return this.treeBuilder.createElement(token.tagName, token.attrs, html.NAMESPACES.HTML);
};

//Tree mutation
Parser.prototype._insertElement = function (element) {
    this.treeBuilder.appendNode(this.openElements.current, element);
    this.openElements.push(element);
};

Parser.prototype._appendElementForToken = function (token) {
    var element = this._createElementForToken(token, true);
    this.treeBuilder.appendNode(this.openElements.current, element);
};

Parser.prototype._insertElementForToken = function (token) {
    var element = this._createElementForToken(token, false);
    this._insertElement(element);
};

Parser.prototype._explicitlyCreateElementAndInsert = function (tagName) {
    var element = this.treeBuilder.createElement(tagName, [], html.NAMESPACES.HTML);
    this._insertElement(element);
};

Parser.prototype._appendCommentNode = function (token) {
    var commentNode = this.treeBuilder.createCommentNode(token.data);
    this.treeBuilder.appendNode(this.openElements.current, commentNode);
};

Parser.prototype._insertCharacter = function (token) {
    this.treeBuilder.insertCharacterToNode(this.openElements.current, token.ch);
};

//Text element parsing
Parser.prototype._parseTextElement = function (currentToken, nextTokenizerState) {
    this._insertElementForToken(currentToken);
    this.tokenizer.state = nextTokenizerState;
    this.originalInsertionMode = this.insertionMode;
    this.insertionMode = TEXT_MODE;
};

//Token processing
Parser.prototype._processToken = function (token) {
    _[this.insertionMode][token.type](this, token);
};

Parser.prototype._processFakeStartTag = function (tagName) {
    this._processToken({
        type: Tokenizer.START_TAG_TOKEN,
        tagName: tagName,
        selfClosing: false,
        attrs: []
    });
};

Parser.prototype._processFakeEndTag = function (tagName) {
    this._processToken({
        type: Tokenizer.END_TAG_TOKEN,
        tagName: tagName,
        selfClosing: false,
        attrs: []
    });
};

//Active formatting elements reconstruction
Parser.prototype._reconstructActiveFormattingElements = function () {
    if (this.activeFormattingElements.length) {
        var unopenElementIdx = this.activeFormattingElements.length,
            entry = null;

        for (var i = this.activeFormattingElements.length - 1; i >= 0; i--) {
            entry = this.activeFormattingElements.list[i];

            if (entry.type === FormattingElementList.MARKER_ENTRY || this.openElements.contains(entry.element)) {
                unopenElementIdx = i + 1;
                break;
            }
        }

        for (var i = unopenElementIdx; i < this.activeFormattingElements.length; i++) {
            entry = this.activeFormattingElements.list[i];
            this._insertElementForToken(entry.token);
            entry.element = this.openElements.current;
        }
    }
};

//Implied end tags
Parser.prototype._generateImpliedEndTags = function () {
    while (idioms.isImpliedEndTagRequired(this.openElements.current.tagName))
        this.openElements.pop();
};