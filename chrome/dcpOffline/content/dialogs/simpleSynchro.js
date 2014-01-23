Components.utils.import("resource://modules/events.jsm");
Components.utils.import("resource://modules/StringBundle.jsm");
Components.utils.import("resource://modules/logger.jsm");
Components.utils.import("resource://modules/offlineSynchronize.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

window.onload = function () {
    applicationEvent.subscribe("unableToSynchronize", displayError);
    applicationEvent.subscribe("postSynchronize", displayEndOfSynchronize);
    addObserver();
    window.setTimeout(beginSynchronize, 0);
};

function addObserver() {
    offlineSync.setObservers({
        onDetailPercent :        function (p) {
            logConsole(p);
        },
        onGlobalPercent :        function (p) {
            logConsole(p);
        },
        onDetailLabel :          function (t) {
            logConsole(t);
        },
        onAddDocumentsToRecord : function (t) {
            logConsole(t);
        },
        onAddDocumentsRecorded : function (t) {
            logConsole(t);
        },
        onAddFilesToRecord :     function (t) {
            logConsole(t);
        },
        onAddFilesRecorded :     function (t) {
            logConsole(t);
        },
        onAddDocumentsToSave :   function (t) {
            logConsole(t);
        },
        onAddDocumentsSaved :    function (t) {
            logConsole(t);
        },
        onAddFilesToSave :       function (t) {
            logConsole(t);
        },
        onAddFilesSaved :        function (t) {
            logConsole(t);
        },
        onSuccess :              function (result) {
            logConsole(result);
        },
        onError :                function (result) {
            logConsole(result);
        }
    });
}

function displayEndOfSynchronize(result) {
    suppressListener();
    if (result) {
        openDialog("chrome://dcpoffline/content/dialogs/endOfSynchronize.xul", "", "chrome,modal,close=false", result);
    }
    window.close();
}

function suppressListener() {
    applicationEvent.unsubscribe("unableToSynchronize", displayError);
    applicationEvent.unsubscribe("postSynchronize", displayEndOfSynchronize);
}

function displayError(error) {
    var translate = new StringBundle("chrome://dcpoffline/locale/main.properties");
    suppressListener();
    window.close();
    Services.prompt.alert(null, translate.get("synchronize.unable"), error.reason);
}

function beginSynchronize() {
    var firstArgument;
    firstArgument = window.arguments[0];
    if (firstArgument.method && firstArgument.options) {
        try {
            offlineSync[firstArgument.method](firstArgument.options);
        } catch (error) {
            logConsole("error", error);
            displayError({reason : error.message});
        }
    } else {
        displayError({reason : "Bad arguments"});
    }
}