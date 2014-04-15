/**
 * Beware don't use const define here !!!!
 */

Components.utils.import("resource://modules/logger.jsm");
Components.utils.import("resource://modules/network.jsm");
Components.utils.import("resource://modules/preferences.jsm");
Components.utils.import("resource://modules/events.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://modules/fdl-context.jsm");
Components.utils.import("resource://modules/StringBundle.jsm");
Components.utils.import("resource://modules/storageManager.jsm");
Components.utils.import("resource://modules/offlineSynchronize.jsm");
Components.utils.import("resource://modules/docManager.jsm");

function initSynchronize() {
    window.synchroInProgress = false;
    isServerOK();
    addObserver();
    initPage();
    initListeners();
}

function isServerOK() {
    var translate = new StringBundle(
            "chrome://dcpoffline/locale/main.properties");
    if (!networkChecker.isOffline({reset : true}) && context.isAuthenticated()) {
        logConsole("Ready to synchronize");
    } else {
        logConsole("Ready to synchronize");
        document.getElementById("synchronizeButton").disabled = true;
        applicationEvent.publish("unableToSynchronize",{reason : translate.get("synchronize.notConnected")});
    }
}

function addObserver() {
    offlineSync.setObservers({
        onDetailPercent : function(p) {
            document.getElementById('progressDetail').value = p;
        },
        onGlobalPercent : function(p) {
            document.getElementById('progressGlobal').value = p;
        },
        onDetailLabel : function(t) {
            appendText(t);
        },
        onActivityLabel : function (t) {
            updateActivity(t);
        },
        onAddDocumentsToRecord : function(t) {
            myAddDocumentsToRecord(t);
        },
        onAddDocumentsRecorded : function(t) {
            myAddDocumentsRecorded(t);
        },
        onAddFilesToRecord : function(t) {
            myAddFilesToRecord(t);
        },
        onAddFilesRecorded : function(t) {
            myAddFilesRecorded(t);
        },
        onAddDocumentsToSave : function(t) {
            myAddDocumentsToSave(t);
        },
        onAddDocumentsSaved : function(t) {
            myAddDocumentsSaved(t);
        },
        onAddFilesToSave : function(t) {
            myAddFilesToSave(t);
        },
        onAddFilesSaved : function(t) {
            myAddFilesSaved(t);
        },
        onSuccess : function(result) {
            endSynchronize(result);
        },
        onError : function(result) {
            errorOfSynchronize(result);
        }
    });
}

function initPage() {
    var translate = new StringBundle(
    "chrome://dcpoffline/locale/main.properties");
    var domainId = Preferences.get("offline.user.currentSelectedDomain", false);
    if (domainId) {
        updateDomain({domainId : domainId});
    }else {
        applicationEvent.publish("unableToSynchronize",{reason : translate.get("synchronize.noDomainSelected")});
    }
}

function initListeners() {
    applicationEvent.subscribe("synchronize", synchronize, {onError : errorOfSynchronize});
    applicationEvent.subscribe("preSynchronize", verifySynchroState);
    applicationEvent.subscribe("postSynchronize", setEndSynchro);
    applicationEvent.subscribe("changeSelectedDomain", updateDomain);
    applicationEvent.subscribe("unableToSynchronize", errorOfSynchronize);
    window.addEventListener("close", canBeClosed, false);
}

function synchronize() {
    var translate = new StringBundle(
    "chrome://dcpoffline/locale/main.properties");
    if (Preferences.get("offline.user.currentSelectedDomain", false)) {
        var domain = context.getDocument({
            id : Preferences.get("offline.user.currentSelectedDomain")
        });
        document.getElementById('progress').mode = 'undetermined';
        try {
            window.synchroInProgress = true;
            offlineSync.synchronizeDomain({
                domain : domain
            });
        } catch(exception) {
            logDebug(exception);
            applicationEvent.publish("unableToSynchronize",{reason : exception});
        }
    } else {
        applicationEvent.publish("unableToSynchronize",{reason : translate.get("synchronize.noDomainSelected")});
        return false;
    }
}

function verifySynchroState() {
    return !window.synchroInProgress;
}

function setEndSynchro() {
    window.synchroInProgress = false;
}

function updateDomain(config) {
    if (config && config.domainId) {
        var currentDomain = storageManager.getDomainValues({domainid : config.domainId});
        try {
            document.getElementById('currentLabelId').value = currentDomain.description;
        } catch(e) {
            Services.prompt.alert(window, "synchronize.unableToDisplayDomainDescription", e);
        }
    }
}

function tryToSynchronize() {
    if (!applicationEvent.publish("preSynchronize")) {
        return;
    }
    applicationEvent.publish("synchronize");
}

function endSynchronize(result) {
    var button = document.getElementById("cancelButton");
    document.getElementById('progress').value = 100;
    document.getElementById('progress').mode = 'determined';
    if (button) {
        button.disabled = false;
    }
    window.synchroInProgress = false;
    applicationEvent.publish("postSynchronize", {result : true, description : result});
}

function errorOfSynchronize(result) {
    var message = "", button = document.getElementById("cancelButton"), translate;
    document.getElementById('progress').value = 100;
    document.getElementById('progress').mode = 'determined';
    if (button) {
        button.disabled = false;
    }
    if (result && result.reason) {
        message = result.reason.message || result.reason;
    }
    translate = new StringBundle("chrome://dcpoffline/locale/main.properties");
    logConsole("Unable to synchronize ", result);
    window.alert(translate.get("synchronize.unable") + " : " + message);
    window.synchroInProgress = false;
    applicationEvent.publish("postSynchronize", {description : {status : false, message : result}});
}

/*Close IHM*/
function canBeClosed(event) {
    if (document.getElementById("cancelButton").disabled) {
        event.preventDefault();
    }
    else {
        letClose();
    }
}

function letClose() {
    applicationEvent.unsubscribe("synchronize", synchronize);
    applicationEvent.unsubscribe("changeSelectedDomain", updateDomain);
    window.close();
}

/*Update IHM*/
function myAddDocumentsToRecord(delta) {
    var r = document.getElementById('documentsToRecord');
    r.value = parseInt(r.value) + delta;
}

function myAddDocumentsRecorded(delta) {
    var r = document.getElementById('documentsRecorded');
    r.value = parseInt(r.value) + delta;

}
function myAddFilesToRecord(delta) {

    var r = document.getElementById('filesToRecord');
    r.value = parseInt(r.value) + delta;
}

function myAddFilesRecorded(delta) {

    var r = document.getElementById('filesRecorded');
    r.value = parseInt(r.value) + delta;
}

function myAddDocumentsToSave(delta) {
    var r = document.getElementById('documentsToSave');
    r.value = parseInt(r.value) + delta;
}

function myAddDocumentsSaved(delta) {
    var r = document.getElementById('documentsSaved');
    r.value = parseInt(r.value) + delta;
}
function myAddFilesToSave(delta) {
    var r = document.getElementById('filesToSave');
    r.value = parseInt(r.value) + delta;
}

function myAddFilesSaved(delta) {

    var r = document.getElementById('filesSaved');
    r.value = parseInt(r.value) + delta;
}

function appendText(text) {
    var date = new Date(),
        padding = function(value) {
                if (value < 10) {
                    value = "0"+value;
                }
            return value;
        };
    text = padding(date.getHours())+":"+ padding(date.getMinutes())+":"+padding(date.getSeconds())+" "+text;
    document.getElementById('progressMessages').value = text + "\n" + document.getElementById('progressMessages').value;
}

function updateActivity(text) {
    document.getElementById('synchroActivity').value = text;
}
