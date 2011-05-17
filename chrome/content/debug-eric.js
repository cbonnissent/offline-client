// start_venkman();
Components.utils.import("resource://modules/logger.jsm");
Components.utils.import("resource://modules/docManager.jsm");

Components.utils.import("resource://modules/storageManager.jsm");
Components.utils.import("resource://modules/fdl-context.jsm");
Components.utils.import("resource://modules/fdl-data-debug.jsm");
Components.utils.import("resource://modules/offlineSynchronize.jsm");

function initEricContext() {
	context.url = 'http://localhost/eric/';

	if (!context.isAuthenticated()) {
		var u = context.setAuthentification({
			login : 'nono',
			password : 'anakeen'
		});
		if (!u)
			alert('error authent:' + context.getLastErrorMessage());
		logTime(u.lastname + ' is log in');
	}

}
function clicOfflineDomains() {
	offlineSync.setProgressElements({
		global : document.getElementById('progressGlobal'),
		detail : document.getElementById('progressDetail'),
		label : document.getElementById('detailLabel')
	});
	var label=document.getElementById('domain');
	var domains = offlineSync.recordOfflineDomains();
	var onedom=null;
	for ( var i = 0; i < domains.length; i++) {
		onedom=domains.getDocument(i);
		label.value+="\n--"+onedom.getTitle();
		offlineSync.synchronizeDomain(onedom);
	}
	label.value+="\nFINISH";
	
}