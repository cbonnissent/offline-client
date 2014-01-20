Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://modules/StringBundle.jsm");
Components.utils.import("resource://modules/events.jsm");

window.onload = function() {
    applicationEvent.subscribe("unableToSynchronize", displayError);
    applicationEvent.subscribe("postSynchronize", displayEndOfSynchronize);
    initSynchronize();
};

function displayError(error) {
    Components.utils.import("resource://modules/StringBundle.jsm");
    Components.utils.import("resource://modules/events.jsm");
    var translate = new StringBundle("chrome://dcpoffline/locale/main.properties");
    applicationEvent.unsubscribe("unableToSynchronize", displayError);
    applicationEvent.unsubscribe("postSynchronize", displayEndOfSynchronize);
    window.close();
    Services.prompt.alert(null, translate.get("synchronize.unable"), error.reason);
}

function displayEndOfSynchronize(result) {
    Components.utils.import("resource://modules/events.jsm");
    applicationEvent.unsubscribe("unableToSynchronize", displayError);
    applicationEvent.unsubscribe("postSynchronize", displayEndOfSynchronize);
    openDialog("chrome://dcpoffline/content/dialogs/endOfSynchronize.xul", "", "chrome,modal,close=false", result);
    window.letClose();
}

function letSynchronize() {
    document.getElementById("synchronizeButton").disabled = true;
    document.getElementById("cancelButton").disabled = true;
    window.addEventListener("beforeunload", function() {
            return "You cannot close during synchronize";
        }, false);
    tryToSynchronize();
}