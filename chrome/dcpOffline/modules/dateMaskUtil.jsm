var EXPORTED_SYMBOLS = ["maskDateUtil"];

Components.utils.import("resource://modules/logger.jsm");
Components.utils.import("resource://modules/moment.jsm");
Components.utils.import("resource://modules/lexer.jsm");
Components.utils.import("resource://modules/preferences.jsm");

var maskDateUtil = {};

(function(maskDateUtil, moment, lexer) {

    var userLocaleFormat = JSON.parse(
        Preferences.get(
        "offline.user.localeFormat",
        "{\"dateFormat\":\"%d/%m/%Y\",\"timeFormat\":\"%H:%M:%S\",\"dateTimeFormat\":\"%d/%m/%Y %H:%M\"}")),
        rules = {
            "%d": function() {
                return {
                    iso: 'DD',
                    mask: '__',
                    regexp: ['[0-3]', '[0-9]']
                };
            },
            "%e": function() {
                return {
                    iso: 'DD',
                    mask: '__',
                    regexp: ['[0-3]', '[0-9]']
                };
            },
            "%H": function() {
                return {
                    iso: 'HH',
                    mask: '__',
                    regexp: ['[0-2]', '[0-9]']
                };
            },
            "%j": function() {
                return {
                    iso: 'DDDD',
                    mask: '___',
                    regexp: ['[0-9]', '[0-9]', '[0-9]']
                };
            },
            "%I": function() {
                return {
                    iso: 'hh',
                    mask: '__',
                    regexp: ['[0-1]', '[0-9]']
                };
            },
            '%k': function() {
                return {
                    iso: 'DD',
                    mask: '__',
                    regexp: ['[0-2]', '[0-9]']
                };
            },
            "%m": function() {
                return {
                    iso: 'MM',
                    mask: '__',
                    regexp: ['[0-1]', '[0-9]']
                };
            },
            "%M": function() {
                return {
                    iso: 'mm',
                    mask: '__',
                    regexp: ['[0-5]', '[0-9]']
                };
            },
            "%p": function() {
                return {
                    iso: 'A',
                    mask: '__',
                    regexp: ['[AP]', '[M]']
                };
            },
            "%S": function() {
                return {
                    iso: 'ss',
                    mask: '__',
                    regexp: ['[0-5]', '[0-9]']
                };
            },
            "%u": function() {
                return {
                    iso: 'd',
                    mask: '_',
                    regexp: ['[1-7]']
                };
            },
            "%y": function() {
                return {
                    iso: 'YY',
                    mask: '__',
                    regexp: ['[0-9]', '[0-9]']
                };
            },
            "%Y": function() {
                return {
                    iso: 'YYYY',
                    mask: '____',
                    regexp: ['[1-2]', '[0-9]', '[0-9]', '[0-9]']
                };
            },
            '.': function(text) {
                return text;
            }
        },
        generateISOFromSprintf = function(formatTokens) {
            var i, length, momentFormat = "";
            for (i = 0, length = formatTokens.length; i < length; i++) {
                momentFormat += formatTokens[i].iso ? formatTokens[i].iso : formatTokens[i];
            }
            return momentFormat;
        },
        strftime = function(momentObject, formatTokens) {
            var momentFormat = generateISOFromSprintf(formatTokens);
            return momentObject.format(momentFormat);
        },
        strptime = function(string, formatTokens) {
            var momentFormat = generateISOFromSprintf(formatTokens);
            return moment(string, momentFormat);
        };

    maskDateUtil.generateFormatTokens = function(kind) {
        var l, token, formatTokens = [];
        if (!userLocaleFormat[kind]) {
            throw "Unkown kind of mask";
        }
        l = new lexer(userLocaleFormat[kind], rules);

        formatTokens = [];
        while ((token = l.lex()) != lexer.EOF) {
            formatTokens.push(token);
        }
        return formatTokens;
    };


    maskDateUtil.generateRegExp = function(formatTokens) {
        var i, length, regExp = [], convertToRegExp = function(regExp) {
            var i, length;
            for (i = 0, length = regExp.length; i < length; i++) {
              regExp[i] = new RegExp(regExp[i]);
            }
            return regExp;
          };
          for (i = 0, length = formatTokens.length; i <  length; i++) {
            regExp = regExp.concat(formatTokens[i].regexp ? convertToRegExp(formatTokens[i].regexp) : formatTokens[i]);
          }

          return regExp;
    };

    maskDateUtil.generateMask = function(formatTokens) {
        var i, length, mask = "";
        for (i = 0, length = formatTokens.length; i <  length; i++) {
            mask += formatTokens[i].iso ? formatTokens[i].mask : formatTokens[i];
        }
        return mask;
    };

    maskDateUtil.checkDate = function(value, formatTokens) {
        var date = strptime(value, formatTokens);
        return date && date.isValid();
    };

    maskDateUtil.getLiteralDate = function(value, formatTokens, momentFormat) {
        var date = strptime(value, formatTokens);
        momentFormat = momentFormat || "dddd DD MMMM YYYY";
        return date.format(momentFormat);
    };

    maskDateUtil.getIsoRepresentation = function(localValue, formatTokens) {
        return maskDateUtil.getLiteralDate(localValue, formatTokens, "YYYY-MM-DD");
    };

    maskDateUtil.getLocaleRepresentation = function(isoValue, formatTokens) {
        var date = moment(isoValue, "YYYY-MM-DD");
        if (!date) {
            return "";
        }
        return strftime(date, formatTokens);
    };

})(maskDateUtil, moment, lexer);