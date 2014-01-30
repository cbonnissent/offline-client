const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Components.utils.import("resource://modules/storageManager.jsm");
Components.utils.import("resource://modules/logger.jsm");

const CLASS_ID = Components.ID('9a327740-8732-11e3-baa7-0800200c9a66'); // ← Change this
const CLASS_NAME = "Docid AutoComplete";
const CONTRACT_ID = '@mozilla.org/autocomplete/search;1?name=docid-autocomplete';

/**
 * @constructor
 *
 * @implements {nsIAutoCompleteResult}
 *
 * @param {string} searchString
 * @param {number} searchResult
 * @param {number} defaultIndex
 * @param {string} errorDescription
 * @param {Array.<string>} results
 * @param {Array.<string>|null=} comments
 */

function ProviderAutoCompleteResult(searchString, searchResult, defaultIndex, errorDescription, results, comments) {
    this._searchString = searchString;
    this._searchResult = searchResult;
    this._defaultIndex = defaultIndex;
    this._errorDescription = errorDescription;
    this._results = results;
    this._comments = comments;
}

ProviderAutoCompleteResult.prototype = {
    _searchString :     "",
    _searchResult :     0,
    _defaultIndex :     0,
    _errorDescription : "",
    _results :          [],
    _comments :         [],

    /**
     * @return {string} the original search string
     */
    get searchString() {
        return this._searchString;
    },

    /**
     * @return {number} the result code of this result object, either:
     *   RESULT_IGNORED   (invalid searchString)
     *   RESULT_FAILURE   (failure)
     *   RESULT_NOMATCH   (no matches found)
     *   RESULT_SUCCESS   (matches found)
     */
    get searchResult() {
        return this._searchResult;
    },

    /**
     * @return {number} the index of the default item that should be entered if
     *   none is selected
     */
    get defaultIndex() {
        return this._defaultIndex;
    },

    /**
     * @return {string} description of the cause of a search failure
     */
    get errorDescription() {
        return this._errorDescription;
    },

    /**
     * @return {number} the number of matches
     */
    get matchCount() {
        return this._results.length;
    },

    /**
     * @return {string} the value of the result at the given index
     */
    getValueAt : function (index) {
        return JSON.stringify(this._results[index]);
    },

    /**
     * @return {string} the comment of the result at the given index
     */
    getCommentAt : function (index) {
        if (this._comments)
            return this._comments[index];
        else
            return '';
    },

    /**
     * @return {string} the style hint for the result at the given index
     */
    getStyleAt : function (index) {
        if (!this._comments || !this._comments[index]) {
            return null; // not a category label, so no special styling
        }

        if (index === 0) {
            return 'suggestfirst';
        }

        return 'suggesthint';
    },

    /**
     * Gets the image for the result at the given index
     *
     * @return {string} the URI to the image to display
     */
    getImageAt : function (index) {
        return '';
    },

    /**
     * Removes the value at the given index from the autocomplete results.
     * If removeFromDb is set to true, the value should be removed from
     * persistent storage as well.
     */
    removeValueAt : function (index, removeFromDb) {
        this._results.splice(index, 1);

        if (this._comments)
            this._comments.splice(index, 1);
    },

    getLabelAt : function (index) {
        return this._results[index].title;
    },

    QueryInterface : XPCOMUtils.generateQI([Ci.nsIAutoCompleteResult])
};

/**
 * @constructor
 *
 * @implements {nsIAutoCompleteSearch}
 */

function ProviderAutoCompleteSearch() {
}

ProviderAutoCompleteSearch.prototype = {

    classID :          CLASS_ID,
    classDescription : CLASS_NAME,
    contractID :       CONTRACT_ID,

    /**
     * Searches for a given string and notifies a listener (either synchronously
     * or asynchronously) of the result
     *
     * @param searchString the string to search for
     * @param searchParam an extra parameter
     * @param previousResult a previous result to use for faster searchinig
     * @param listener the listener to notify when the search is complete
     */
    startSearch : function (searchString, searchParam, previousResult, listener) {
        var results = [];

        results = storageManager
            .execQuery({
                query :  "select initid, title from doctitles where famname = :famname AND title like :title",
                params : {
                    famname : searchParam || "",
                    title :   "%" + searchString + "%"
                }
            });
        var autocomplete_result = new ProviderAutoCompleteResult(searchString,
            Ci.nsIAutoCompleteResult.RESULT_SUCCESS, 0, "", results, null);

        listener.onSearchResult(this, autocomplete_result);
    },

    /**
     * Stops an asynchronous search that is in progress
     */
    stopSearch : function () {
    },

    QueryInterface : XPCOMUtils.generateQI([Ci.nsIAutoCompleteSearch])
};

// The following line is what XPCOM uses to create components
const NSGetFactory =
    XPCOMUtils.generateNSGetFactory([ProviderAutoCompleteSearch]);