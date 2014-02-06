Components.utils.import("resource://modules/getText.jsm");
Components.utils.import("resource://modules/logger.jsm");
Components.utils.import("resource://modules/docManager.jsm");

function initDialog() {

    var result = window.arguments[0], reportPath, message = "", currentElement, localDocument, title;

    logConsole('endSync', result);

    if (result) {
        if (result.description) {
            if (result.description.hasOwnProperty("status")) {
                if (result.description.status == "successTransaction") {
                    document.getElementById("resultStatus").value = getText("synchronize.success");
                } else if (result.description.status == "abortTransaction" || result.description.status === false) {
                    document.getElementById("resultStatus").value = getText("synchronize.fail");
                } else {
                    document.getElementById("resultStatus").value = result.description.status;
                }
            }

            if (result.description.manageWaitingUrl) {
                document.getElementById("onlineSpaceLink").href = result.description.manageWaitingUrl;
                document.getElementById("onlineSpaceLink").tooltipText = result.description.manageWaitingUrl;
            }

            if (result.description.message && result.description.message.detailStatus) {
                document.getElementById("message").hidden = false;
                for(currentElement in result.description.message.detailStatus) {
                    if (result.description.message.detailStatus.hasOwnProperty(currentElement)
                        && result.description.message.detailStatus[currentElement].statusMessage) {
                        if (result.description.message.detailStatus[currentElement].localId) {
                            localDocument = docManager.getLocalDocument({
                                initid : result.description.message.detailStatus[currentElement].localId
                            });
                            title = localDocument.getTitle();
                            message += title || "";
                        }
                        message += "\t"+result.description.message.detailStatus[currentElement].statusMessage+" : "+getText("synchronize.shouldEdit")+"\n";
                    }
                }
                document.getElementById("message").value = message;
            }
        } else {
            if (result.result) {
                document.getElementById("resultStatus").value = getText("synchronize.success");
            } else {
                document.getElementById("resultStatus").value = getText("synchronize.fail");
            }
        }
    } else  {
        document.getElementById("resultStatus").collapsed = true;
        document.getElementById("resultLabel").collapsed = true;
    }
    reportPath = computeReportPath();
    if (reportPath) {
        document.getElementById("reportFrame").setAttribute("src", "file://"+reportPath+'/#showOnlyLastTransaction');
    }
}

function openServerStatusPage() {
    var result = window.arguments[0];
    if (result && result.description && result.description.manageWaitingUrl) {
        // first construct an nsIURI object using the ioservice
        var ioservice = Components.classes["@mozilla.org/network/io-service;1"]
            .getService(Components.interfaces.nsIIOService);

        var uriToOpen = ioservice.newURI(result.description.manageWaitingUrl,
            null, null);

        var extps = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
            .getService(Components.interfaces.nsIExternalProtocolService);

        // now, open it!
        extps.loadURI(uriToOpen);
    }
}

function computeReportPath(domainName){
    var domainId, manager, reportFile;
    if(!domainName){
        domainId = getCurrentDomain();
        manager=storageManager
                .execQuery({
                    query : "select * from domains where id=:domainid",
                        params:{
                            domainid:domainId
                        }
                });
        if (manager.length == 1) {
            domainName = manager[0].name;
        } else {
            logIHM("openSynchroReport : could not get domain name (domain id is "+domainId+')');
        }
    }
    reportFile = Components.classes["@mozilla.org/file/directory_service;1"]
            .getService(Components.interfaces.nsIProperties)
            .get("ProfD", Components.interfaces.nsILocalFile);
    reportFile.append('Logs');
    reportFile.append('report-' + domainName + '.html');
    if(reportFile.exists()){
        return reportFile.path;
    } else {
        return false;
    }
}