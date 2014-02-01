const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://modules/logger.jsm");
Cu.import("resource://modules/storageManager.jsm");
Cu.import("resource://modules/utils.jsm");
Cu.import("resource://modules/docManager.jsm");
//Cu.import("resource://gre/modules/PrivateBrowsingUtils.jsm");

var EXPORTED_SYMBOLS = ["fileManager"];
const STATE_START = Components.interfaces.nsIWebProgressListener.STATE_START;
const STATE_STOP = Components.interfaces.nsIWebProgressListener.STATE_STOP;
const PATH_FILES = "Files";
const PERMISSIONS_WRITABLE = 0660;
const PERMISSIONS_NOT_WRITABLE = 0440;

const TABLE_FILES = 'files';
const STATUS_DONE = 1;
const STATUS_UNDEF = -1;

//var privacy = PrivateBrowsingUtils.privacyContextFromWindow(urlSourceWindow);
var nbMaxDl = 3;
var filesRoot = Services.dirsvc.get("ProfD", Ci.nsILocalFile);
filesRoot.append(PATH_FILES);

var fileDwldProgress = {};

var fileManager = {
    //region public
    /**
     * ******************************************************************************************************
     * ** Public function
     * ******************************************************************************************************
     * /
     /**
     * Open a file
     *
     * @param config {initid : initid of the associated doc, attrid : attrid in the associated doc}
     *
     * @returns void
     */
    openFile :      function openFile(config) {
        var f = this.getFile(config);
        try {
            f.launch();
        } catch (ex) {
            // if launch fails, try sending it through the system's external
            // file: URL handler
            openExternal(f);
        }
    },
    /**
     * retrieve files from server
     *
     * @parameter {files : [url],
     * acquitFileCallback : function => called after each file dl,
     * completeFileCallback : function => called after all download}
     *
     * @return void
     */
    downloadFiles : function downloadFiles(config) {
        var nbCurrentDl = 0,
            afterDl,
            onErrorDl,
            filesToDl,
            completeCallBack = config.completeFileCallback || null,
            i,
            currentFileManager = this;
        if (this.downloadInProgress) {
            downloadFiles.downloadToBeDone = downloadFiles.downloadToBeDone || [];
            downloadFiles.downloadToBeDone.push([config]);
            return;
        }
        if (config.files && config.files.length) {
            afterDl = function(file) {
                logConsole("Download ended", { file : file.url, nbCurrentDl : nbCurrentDl});
                updateFileSyncDate({
                    initid : file.initid
                });
                if (config.hasOwnProperty("acquitFileCallback")) {
                    config.acquitFileCallback(currentFileManager, file);
                }
                if (nbCurrentDl > 0) {
                    nbCurrentDl = nbCurrentDl - 1;
                    return;
                }
                currentFileManager.downloadInProgress = false;
                if (completeCallBack) {
                    completeCallBack.call(currentFileManager, currentFileManager);
                }
                if (downloadFiles.downloadToBeDone && downloadFiles.downloadToBeDone.length) {
                    downloadFiles.apply(currentFileManager, downloadFiles.downloadToBeDone.pop());
                }
            };
            onErrorDl = function(file) {
                logConsole("Error dl", { file : file.url, nbCurrentDl : nbCurrentDl});
                var config = {};
                config.files = [{
                    url : file.url,
                    basename : file.basename,
                    index : file.index,
                    serverid : file.serverid,
                    attrid : file.attrid,
                    initid : file.initid,
                    writable : file.writable
                }];
                downloadFiles.call(currentFileManager, config);
                if (nbCurrentDl > 0) {
                    nbCurrentDl = nbCurrentDl - 1;
                    return;
                }
                currentFileManager.downloadInProgress = false;
                if (completeCallBack) {
                    completeCallBack.call(currentFileManager, currentFileManager);
                }
                if (downloadFiles.downloadToBeDone && downloadFiles.downloadToBeDone.length) {
                    downloadFiles.apply(currentFileManager, downloadFiles.downloadToBeDone.pop());
                }
            };
            currentFileManager.downloadInProgress = true;
            filesToDl = config.files.slice(0, nbMaxDl);
            nbCurrentDl = filesToDl.length - 1;
            // Test if all files will downloaded this time
            if (filesToDl.length < config.files.length) {
                // if not doesn't launch completeCallBack
                completeCallBack = null;
                // reduce the download list of nb currently downloaded elements
                config.files = config.files.slice(nbMaxDl);
                // add it to stack
                downloadFiles(config);
            }
            for(i = 0; i < filesToDl.length; i++) {
                downloadAFile(filesToDl[i], {
                    onSuccess : afterDl,
                    onError : onErrorDl
                })
            }
        } else {
            if (completeCallBack) {
                completeCallBack();
            }
        }

    },
    /**
     * Find all the files not associated to a document and clean it
     *
     * @return void
     */
    deleteOrphanfiles : function () {
        var result, i, destDir, currentFileManager = this, done = {};
        result = storageManager.execQuery({
            query : "SELECT * FROM files WHERE initid not in (select initid from docsbydomain)"
        });
        for (i in result) {
            if (!result.hasOwnProperty(i)) {
                continue;
            }
            if (result.hasOwnProperty(i) && result[i].initid && result[i].attrid && result[i].index) {
                currentFileManager.deleteFile({
                    initid :     result[i].initid,
                    attrid :     result[i].attrid,
                    localIndex : result[i].index
                });
            }
        }
        for (i in result) {
            if (!result.hasOwnProperty(i)) {
                continue;
            }
            if (result.hasOwnProperty(i) && !done[result[i].initid+result[i].attrid] && result[i].initid && result[i].attrid) {
                destDir = filesRoot.clone();
                destDir.append(result[i].initid);
                destDir.append(result[i].attrid);
                try {
                    destDir.remove(true);
                    done[result[i].initid + result[i].attrid] = true;
                } catch (e) {
                    logError(e);
                    logError(destDir.path);
                }
            }
        }
        for (i in result) {
            if (!result.hasOwnProperty(i)) {
                continue;
            }
            if (result.hasOwnProperty(i) && result[i].initid && !done[result[i].initid]) {
                destDir = filesRoot.clone();
                destDir.append(result[i].initid);
                try {
                    destDir.remove(true);
                    done[result[i].initid] = true;
                } catch (e) {
                    logError(e);
                }
            }
        }
        storageManager.execQuery({
            query : "DELETE FROM files WHERE initid not in (select initid from docsbydomain)"
        });
    },
    cleanUselessFiles : function() {
        var result, i;
        if (this.downloadInProgress) {
            return;
        }
        result = storageManager.execQuery({
            query : "SELECT initid, attrid FROM files GROUP BY initid, attrid;"
        });
        for(i = 0; i < result.length; i++) {
            cleanFileSync({initid : result[i].initid, attrid: result[i].attrid});
        }
    },
    /**
     * Save a file on the hard disk and save coordinate on the BdD
     * @param config {initid : initid of the associated doc, attrid : attrid in the associated doc,
     * basename : name of the file, aFile : @mozilla.org/file/local}
     * @param argument {onError : callback called if save is impossible}
     */
    saveFile : function saveFile(config, callback) {
        return saveAFile.apply(this, arguments);
    },
    /**
     * Suppress a file of the hard disk
     * Beware : don't suppress the file BdD
     * @param config {initid : initid of the associated doc, attrid : attrid in the associated doc,
     * basename : name of the file, index : index of the file in the attr || localindex : localindex in the BdD }
     */
    deleteFile : function(config) {
        if (config && config.initid && config.attrid
                && (config.index || config.localIndex)) {
            if (!config.hasOwnProperty('index')) {
                config.index = -1;
            }

            var destDir = filesRoot.clone();
            destDir.append(config.initid);
            destDir.append(config.attrid);

            if (!config.localIndex) {
                config.localIndex = docManager.getLocalDocument({
                    initid : config.initid

                }).getValue(config.attrid, config.index);
            }
            if (config.localIndex) {
                destDir.append(config.localIndex);
                try {
                    destDir.remove(true);
                    dropFile(config);
                } catch (e) {
                    logError(e);
                    logError(destDir.path);
                }
            }

        } else {
            logError('deleteFile : missing parameters');
        }
    },

    /**
     * return files modified
     * @param int config.onlyDocument the identificator of document to find modified files of this documents
     *
     * @return array [{rowid, initid, attrid, index, basename, path, serverid, writable, recorddate, modifydate}]
     **/
    getModifiedFiles : function(config) {
        if (config && config.domain) {
            var domainId = config.domain;
            this.updateModificationDates();
            var r=null;
            if (config.onlyDocument) {
                r = storageManager
                .execQuery({
                    query : "select files.* from files, docsbydomain where files.initid=:initid and docsbydomain.initid = files.initid and docsbydomain.domainid=:domainid and docsbydomain.editable=1 and recorddate is not null and (recorddate < modifydate or serverid='newFile')",
                    params : {
                        domainid : domainId,
                        initid : config.onlyDocument
                    }
                });
            } else {
                // all documents
                r = storageManager
                .execQuery({
                    query : "select files.* from files, docsbydomain where docsbydomain.initid = files.initid and docsbydomain.domainid=:domainid and docsbydomain.editable=1 and recorddate is not null and (recorddate < modifydate or serverid='newFile')",
                    params : {
                        domainid : domainId
                    }
                });
            }
            return r;
        } else {
            logError('getModifiedFiles : missing domain parameters');
        }
    },
    /**
     * init recorddate when files were downloaded
     *
     * @param void
     *
     * @return void
     */
    initModificationDates : function() {
        var r = storageManager.execQuery({
            query : 'SELECT * from ' + TABLE_FILES
                    + ' WHERE recorddate is null'

        });
        var file = Components.classes["@mozilla.org/file/local;1"]
                .createInstance(Components.interfaces.nsILocalFile);
        for ( var i = 0; i < r.length; i++) {
            file.initWithPath(r[i].path);
            try {
                storageManager
                        .execQuery({
                            query : 'update '
                                    + TABLE_FILES
                                    + ' set recorddate=:recorddate, modifydate=:recorddate WHERE "initid"=:initid and "index"=:index and attrid=:attrid',
                            params : {
                                recorddate : new Date(file.lastModifiedTime)
                                        .toISOString(),
                                initid : r[i].initid,
                                index : r[i].index,
                                attrid : r[i].attrid
                            }
                        });
            } catch (e) {
                logError(e);
            }
        }
    },

    /**
     * update modifydate from files
     *
     * @return boolean true if at least one touch is done
     */
    updateModificationDates : function(initid) {
        var r = storageManager.execQuery({
            query : 'SELECT *' + ' FROM ' + TABLE_FILES
                    + ' WHERE recorddate is not null'
                    + (initid ? ' AND initid=:initid' : ''),
            params : {
                initid : initid
            }
        });
        var mdate;
        var file = Components.classes["@mozilla.org/file/local;1"]
                .createInstance(Components.interfaces.nsILocalFile);
        var localDoc = null;
        var touches=false;
        for ( var i = 0; i < r.length; i++) {
            file.initWithPath(r[i].path);
            try {
                mdate = new Date(file.lastModifiedTime).toISOString();
                if (mdate != r[i].modifydate) {
                    storageManager
                            .execQuery({
                                query : 'update ' + TABLE_FILES
                                        + ' SET modifydate=:modifydate'
                                        + ' WHERE "initid"=:initid'
                                        + ' AND "index"=:index'
                                        + ' AND attrid=:attrid',
                                params : {
                                    modifydate : mdate,
                                    initid : r[i].initid,
                                    index : r[i].index,
                                    attrid : r[i].attrid
                                }
                            });

                    localDoc = docManager.getLocalDocument({
                        initid : r[i].initid
                    });
                    try {
                        localDoc.touch(new Date(file.lastModifiedTime));
                        touches=true;
                    } catch (e) {
                        // nothing may be not in good domain
                        // normaly never go here
                        logError(e);
                    }
                }
            } catch (e) {
                logError(e);
                logError(file);
                logError(file.path);
            }
        }
        return touches;
    },
    /**
     * Get a file component element
     *
     * @param config {initid : initid of the associated doc, attrid : attrid in the associated doc}
     *
     * @returns null|@mozilla.org/file/local
     */
    getFile : function getFile(config) {
        if (config && config.initid && config.attrid) {
            if (!config.hasOwnProperty('index')) {
                config.index = -1;
            } else if (config.index === null) {
                config.index = -1;
            }

            config.index = docManager.getLocalDocument({
                initid : config.initid
            }).getValue(config.attrid, config.index);

            /* BEWARE : config.index is an array if the attr is multiple and the code below cannot handle it */

            if (!config.index) {
                return null;
            }
            if (!Array.isArray(config.index)) {
                var r = storageManager
                   .execQuery({
                       query : 'SELECT path from '
                               + TABLE_FILES
                               + ' WHERE "initid" = :initid AND "attrid" = :attrid AND "index" = :index',
                       params : {
                           initid : config.initid,
                           attrid : config.attrid,
                           index : config.index
                       }
                   });

               if (r.length > 0) {
                   config.path = r[0].path;

                   var aFile = Services.dirsvc.get("TmpD", Ci.nsILocalFile);
                   aFile.initWithPath(config.path);

                   if (aFile.exists()) {
                       return aFile;
                   } else {
                       throw (new Error('file [' + config.path
                               + '] does not exists'));
                   }
               }
            }

        }
        return null;
    }
};
//endregion public
//region utilities
/**
 * ******************************************************************************************************
 * ** Various utilities elements
 * ******************************************************************************************************
 * /
/**
 * Open an url with os
 *
 * @param aFile
 */
function openExternal(aFile) {
    var uri = Cc["@mozilla.org/network/io-service;1"].getService(
            Ci.nsIIOService).newFileURI(aFile);

    var protocolSvc = Cc["@mozilla.org/uriloader/external-protocol-service;1"]
            .getService(Ci.nsIExternalProtocolService);
    protocolSvc.loadUrl(uri);
}
/**
 * Update the synchro date
 *
 * @param config {initid : initid of the associated doc}
 */
function updateFileSyncDate(config) {
    var now = new Date();
    if (config && config.initid) {
        var clientDate = now.toISOString();
        storageManager
            .execQuery({
                query :  "update synchrotimes set lastsynclocal=:clientDate where initid=:initid",
                params : {
                    clientDate : clientDate,
                    initid :     config.initid
                }
            });
    } else {
        throw new ArgException("updateFileSyncDate need document parameter");
    }
}
function downloadAFile(file, callback) {
    var uri, persist;
    if (!file || !file.url || !file.basename) {
        throw "Unable to DL "+JSON.stringify(file);
    }
    logConsole("Begin to dl", { file : file.url});
    file.aFile = createTmpFile();
    try {
        uri = Components.classes["@mozilla.org/network/io-service;1"]
            .getService(Components.interfaces.nsIIOService).newURI(
                file.url, null, null);
    } catch (e) {
        throw('the file ' + file.name + 'does not exist' + " "+ file.url);
    }
    persist = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
        .createInstance(Components.interfaces.nsIWebBrowserPersist);
    persist.progressListener = {
       onProgressChange : callback.onProgressChange || function() {},
       onStateChange : function(aWebProgress, aRequest, aStateFlags, aStatus) {
            var saveCallback = {};
            saveCallback.onError = callback.onError || function (file, error) {
                logError(file);
                logError(error);
            };
            saveCallback.onSuccess = callback.onSuccess || undefined;
            //noinspection JSBitwiseOperatorUsage
            if (aStateFlags & STATE_STOP) {
                if (file.writable) {
                    file.aFile.permissions = 0444;
                }
                file.serverFile = true;
                saveAFile(file, saveCallback);
            }
        }
    };
    persist.persistFlags = Components.interfaces.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;
    persist.saveURI(uri, null, null, null, "", file.aFile, null);
}
/**
 * Clean all the files of a local document
 *
 * @param config {initid : initid of the associated doc, attrid : attrid}
 *
 * @return void
 */
function cleanFileSync(config) {
    var i, j, currentFile, values, isUseful, result;
    var localDocument = docManager.getLocalDocument({
        initid : config.initid
    });
    if (localDocument) {
        result = storageManager.execQuery({
            query :  "select * from files where initid=:initid and attrid=:attrid",
            params : {
                initid : config.initid,
                attrid : config.attrid
            }
        });
        //Try to know if the registered files are useful or old registered files
        for (i = 0; i < result.length; i++) {
            currentFile = result[i];
            //Get the value in BdD for the current attribute
            values = localDocument.getValue(currentFile.attrid);
            isUseful = false;
            //If the attribute is multiple the return is an array
            if (Array.isArray(values)) {
                for (j = 0; j < values.length; j++) {
                    if (values[j] === currentFile.index) {
                        //If the value is equal to one of the index the file still used
                        isUseful = true;
                        break;
                    }
                }
            } else {
                //If the attribut is single valued
                if (values == currentFile.index) {
                    isUseful = true;
                }
            }
            //The file is not still used suppress it
            if (isUseful === false) {
                fileManager.deleteFile({
                    initid : currentFile.initid,
                    attrid : currentFile.attrid,
                    localIndex : currentFile.index
                });
            }
        }
    } else {
        logError("Localdocument was not found " + JSON.stringify(config));
    }
}
function saveAFile(config, callback) {

    var error;

    if (config && config.initid && config.attrid && config.basename
        && config.aFile) {
        try {

            config.writable = config.writable || false;

            if (!config.hasOwnProperty('index')) {
                config.index = -1;
            }

            var destDir = null;
            try {
                destDir = this.getFile(config).parent;
            } catch (e) {
                config.uuid = config.uuid
                    || Components.classes["@mozilla.org/uuid-generator;1"]
                    .getService(
                        Components.interfaces.nsIUUIDGenerator)
                    .generateUUID().toString().slice(1, -1);

                destDir = filesRoot.clone();
                destDir.append(config.initid);
                destDir.append(config.attrid);
                destDir.append(config.uuid);
            }

            if (config.aFile) {
                // verify file is in correct dir
                if ((!filesRoot.contains(config.aFile, false))
                    || (config.aFile.leafName != config.basename)) {
                    try {
                        if (config.forceCopy) {
                            config.aFile.copyTo(destDir, config.basename);
                            config.aFile = Components.classes["@mozilla.org/file/local;1"]
                                .createInstance(Components.interfaces.nsILocalFile);
                            config.aFile.initWithPath(destDir.path);
                            config.aFile.append(config.basename);
                            config.newFile = true;
                        } else {
                            config.aFile.moveTo(destDir, config.basename);
                        }
                    } catch (e) {
                        error = 'fileManager::saveFile : could not move the file to ' + destDir.path;
                        logError(error);
                        logError(e);
                        if (callback && callback.onError) {
                            callback.onError(config, error);
                            return;
                        }
                    }
                }
                config.aFile.permissions = config.writable
                    ? PERMISSIONS_WRITABLE
                    : PERMISSIONS_NOT_WRITABLE;
                // set ref in database
                storeFile(config);
                if ((config.uuid) && (config.attrid != 'icon')) {
                    var localDoc = docManager.getLocalDocument({
                        initid : config.initid
                    });
                    if (localDoc) {
                        localDoc.setValue(config.attrid, config.uuid, config.index);
                        localDoc.save({
                            force :              true,
                            noModificationDate : true
                        });
                    }
                }
                if (callback && callback.onSuccess) {
                    callback.onSuccess(config);
                }
            }
        } catch (e) {
            logError(e);
            throw (e);
        }

    } else {
        logError('saveFile : missing parameters');
    }
}
/**
 * Add a file in the BdD
 *
 * @param config {initid : initid of the associated doc, attrid : attrid in the associated doc,
 * basename : name of the file, aFile : @mozilla.org/file/local, index : int, writable : boolean}
 */
function storeFile(config) {
    if (config && config.initid && config.attrid && config.basename
            && config.aFile && config.hasOwnProperty('uuid')
            && config.hasOwnProperty('writable')) {
        if (config.attrid == 'icon') {
            storageManager.execQuery({
                query : 'update families set icon=:path where famid=:initid ',
                params : {
                    initid : config.initid,
                    path : config.aFile.path
                }
            });
        } else {
            try {
                var mdate = new Date(config.aFile.lastModifiedTime)
                        .toISOString();
                var rdate = mdate;
                if (config.newFile && (!config.serverFile)) {
                    rdate = new Date(2000).toISOString();
                }
                storageManager
                        .execQuery({
                            query : 'insert into '
                                    + TABLE_FILES
                                    + '("initid", "attrid", "serverid", "index", "basename", "path", "writable", "recorddate", "modifydate")'
                                    + ' values (:initid, :attrid, :serverid, :index, :basename, :path, :writable, :recorddate, :modifydate)',
                            params : {
                                initid : config.initid,
                                attrid : config.attrid,
                                serverid : (config.serverid)
                                        ? config.serverid
                                        : 'newFile',
                                index : config.uuid,
                                basename : config.basename,
                                path : config.aFile.path,
                                writable : config.writable,
                                recorddate : rdate,
                                modifydate : mdate
                            }
                        });
            } catch (e) {
                logError(e);
                logError('no local file ' + config.attrid);
            }
        }
    } else {
        throw (new ArgException("storeFile : missing arguments"));
    }
}
/**
 * Delete a file from BdD
 @param config {initid : initid of the associated doc, attrid : attrid in the associated doc,
 * localindex : name of the file}
 *
 * @return void
 */
function dropFile(config) {
    if (config && config.initid && config.attrid
            && config.hasOwnProperty('localIndex')) {
        storageManager
                .execQuery({
                    query : 'DELETE FROM '
                            + TABLE_FILES
                            + ' WHERE initid=:initid AND attrid=:attrid AND "index"=:index',
                    params : {
                        initid : config.initid,
                        attrid : config.attrid,
                        index : config.localIndex
                    }
                });
    }
}
/**
 * Create a tmp file
 *
 * @return void
 */
function createTmpFile() {
    var aFile = Services.dirsvc.get("TmpD", Ci.nsILocalFile);
    aFile.append("suggestedName.tmp");
    aFile.createUnique(aFile.NORMAL_FILE_TYPE, 0666);
    return aFile;
}
//endregion utilities