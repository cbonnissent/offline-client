Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://modules/StringBundle.jsm");
Components.utils.import("resource://modules/events.jsm");

window.onload = function() {
    applicationEvent.subscribe("unableToSynchronize", displayError);
    applicationEvent.subscribe("postSynchronize", displayEndOfSynchronize);
    initSynchronize();
};

function displayError(error) {
    if (window && window.close) {
        window.close();
        Services.prompt.alert(null, translate.get("synchronize.unable"), error.reason);
    }
}

function displayEndOfSynchronize(result) {
    if (window) {
        if (window.openDialog) {
            try {
                window.openDialog("chrome://dcpoffline/content/dialogs/endOfSynchronize.xul", "", "chrome,modal,close=false", result);
            } catch(e) {
                
            }
        }
        if (window.letClose) {
            window.letClose();
        }
    }
}

function letSynchronize() {
    document.getElementById("synchronizeButton").disabled = true;
    document.getElementById("cancelButton").disabled = true;
    window.addEventListener("beforeunload", function() {
            return "You cannot close during synchronize";
        }, false);
    tryToSynchronize();
}