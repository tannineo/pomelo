var os = require("os");
var util = require("util");
var exec = require("child_process").exec;

var logger = require("pomelo-logger").getLogger("pomelo", __filename);
var Constants = require("./constants");
var pomelo = require("../pomelo");

var utils = module.exports;

/**
 * 假设传入的cb是function
 * 将之后的参数作为cb的参数 执行cb
 *
 * Invoke callback with check
 */
utils.invokeCallback = function(cb) {
  if (typeof cb === "function") {
    var len = arguments.length;

    // 用if 来判断固定的几个变量数目能提升性能???
    // 不用创建新的args数组???
    if (len == 1) {
      return cb();
    }

    if (len == 2) {
      return cb(arguments[1]);
    }

    if (len == 3) {
      return cb(arguments[1], arguments[2]);
    }

    if (len == 4) {
      return cb(arguments[1], arguments[2], arguments[3]);
    }

    var args = Array(len - 1);
    for (i = 1; i < len; i++) args[i - 1] = arguments[i];
    cb.apply(null, args);
    // cb.apply(null, Array.prototype.slice.call(arguments, 1));
  }
};

/**
 * 获取obj的属性个数 跳过function
 * Get the count of elements of object
 */
utils.size = function(obj) {
  var count = 0;
  for (var i in obj) {
    if (obj.hasOwnProperty(i) && typeof obj[i] !== "function") {
      count++;
    }
  }
  return count;
};

/**
 * 检查字符串后缀
 * Check a string whether ends with another string
 */
utils.endsWith = function(str, suffix) {
  if (
    typeof str !== "string" ||
    typeof suffix !== "string" ||
    suffix.length > str.length
  ) {
    return false;
  }
  return str.indexOf(suffix, str.length - suffix.length) !== -1;
};

/**
 * 检查前缀
 * Check a string whether starts with another string
 */
utils.startsWith = function(str, prefix) {
  if (
    typeof str !== "string" ||
    typeof prefix !== "string" ||
    prefix.length > str.length
  ) {
    return false;
  }

  return str.indexOf(prefix) === 0;
};

/**
 * 从array1中筛选出array2中不存在的值
 * Compare the two arrays and return the difference.
 */
utils.arrayDiff = function(array1, array2) {
  var o = {};
  for (var i = 0, len = array2.length; i < len; i++) {
    o[array2[i]] = true;
  }

  var result = [];
  for (i = 0, len = array1.length; i < len; i++) {
    var v = array1[i];
    if (o[v]) continue;
    result.push(v);
  }
  return result;
};

/**
 *
 * Date format
 */
utils.format = function(date, format) {
  format = format || "MMddhhmm";
  var o = {
    "M+": date.getMonth() + 1, //month
    "d+": date.getDate(), //day
    "h+": date.getHours(), //hour
    "m+": date.getMinutes(), //minute
    "s+": date.getSeconds(), //second
    "q+": Math.floor((date.getMonth() + 3) / 3), //quarter 季度
    S: date.getMilliseconds() //millisecond
  };

  // 如果 format要求年份
  if (/(y+)/.test(format)) {
    format = format.replace(
      RegExp.$1,
      (date.getFullYear() + "").substr(4 - RegExp.$1.length)
    );
  }

  // TODO: 非标准用法 很迷
  for (var k in o) {
    if (new RegExp("(" + k + ")").test(format)) {
      format = format.replace(
        RegExp.$1,
        RegExp.$1.length === 1 ? o[k] : ("00" + o[k]).substr(("" + o[k]).length)
      );
    }
  }
  return format;
};

/**
 * 是否存在中文字符
 * check if has Chinese characters.
 */
utils.hasChineseChar = function(str) {
  if (/.*[\u4e00-\u9fa5]+.*$/.test(str)) {
    return true;
  } else {
    return false;
  }
};

/**
 * unicode 转换 至 utf-8
 * transform unicode to utf8
 */
utils.unicodeToUtf8 = function(str) {
  var i, len, ch;
  var utf8Str = "";
  len = str.length;
  for (i = 0; i < len; i++) {
    ch = str.charCodeAt(i);

    if (ch >= 0x0 && ch <= 0x7f) {
      utf8Str += str.charAt(i);
    } else if (ch >= 0x80 && ch <= 0x7ff) {
      utf8Str += String.fromCharCode(0xc0 | ((ch >> 6) & 0x1f));
      utf8Str += String.fromCharCode(0x80 | (ch & 0x3f));
    } else if (ch >= 0x800 && ch <= 0xffff) {
      utf8Str += String.fromCharCode(0xe0 | ((ch >> 12) & 0xf));
      utf8Str += String.fromCharCode(0x80 | ((ch >> 6) & 0x3f));
      utf8Str += String.fromCharCode(0x80 | (ch & 0x3f));
    } else if (ch >= 0x10000 && ch <= 0x1fffff) {
      utf8Str += String.fromCharCode(0xf0 | ((ch >> 18) & 0x7));
      utf8Str += String.fromCharCode(0x80 | ((ch >> 12) & 0x3f));
      utf8Str += String.fromCharCode(0x80 | ((ch >> 6) & 0x3f));
      utf8Str += String.fromCharCode(0x80 | (ch & 0x3f));
    } else if (ch >= 0x200000 && ch <= 0x3ffffff) {
      utf8Str += String.fromCharCode(0xf8 | ((ch >> 24) & 0x3));
      utf8Str += String.fromCharCode(0x80 | ((ch >> 18) & 0x3f));
      utf8Str += String.fromCharCode(0x80 | ((ch >> 12) & 0x3f));
      utf8Str += String.fromCharCode(0x80 | ((ch >> 6) & 0x3f));
      utf8Str += String.fromCharCode(0x80 | (ch & 0x3f));
    } else if (ch >= 0x4000000 && ch <= 0x7fffffff) {
      utf8Str += String.fromCharCode(0xfc | ((ch >> 30) & 0x1));
      utf8Str += String.fromCharCode(0x80 | ((ch >> 24) & 0x3f));
      utf8Str += String.fromCharCode(0x80 | ((ch >> 18) & 0x3f));
      utf8Str += String.fromCharCode(0x80 | ((ch >> 12) & 0x3f));
      utf8Str += String.fromCharCode(0x80 | ((ch >> 6) & 0x3f));
      utf8Str += String.fromCharCode(0x80 | (ch & 0x3f));
    }
  }
  return utf8Str;
};

/**
 * ping -w 15 host
 * 15个包ping一个远程host
 * linux的ping命令支持'-w' osx不行
 *
 * Ping server to check if network is available
 */
utils.ping = function(host, cb) {
  if (!module.exports.isLocal(host)) {
    var cmd = "ping -w 15 " + host;
    exec(cmd, function(err, stdout, stderr) {
      if (!!err) {
        cb(false);
        return;
      }
      cb(true);
    });
  } else {
    cb(true);
  }
};

/**
 * 检查server是否正常在线
 * Check if server is exsit.
 */
utils.checkPort = function(server, cb) {
  if (!server.port && !server.clientPort) {
    this.invokeCallback(cb, "leisure");
    return;
  }
  var self = this;
  var port = server.port || server.clientPort;
  var host = server.host;
  var generateCommand = function(self, host, port) {
    var cmd;
    var ssh_params = pomelo.app.get(Constants.RESERVED.SSH_CONFIG_PARAMS);
    if (!!ssh_params && Array.isArray(ssh_params)) {
      ssh_params = ssh_params.join(" ");
    } else {
      ssh_params = "";
    }
    if (!self.isLocal(host)) {
      // 通过ssh远程执行
      cmd = util.format(
        "ssh %s %s \"netstat -an|awk '{print $4}'|grep %s|wc -l\"",
        host,
        ssh_params,
        port
      );
    } else {
      cmd = util.format("netstat -an|awk '{print $4}'|grep %s|wc -l", port);
    }
    return cmd;
  };

  // 通过onetstat检查端口是否占用
  var cmd1 = generateCommand(self, host, port);

  var child = exec(cmd1, function(err, stdout, stderr) {
    if (err) {
      logger.error("command %s execute with error: %j", cmd1, err.stack);
      self.invokeCallback(cb, "error");
    } else if (stdout.trim() !== "0") {
      self.invokeCallback(cb, "busy");
    } else {
      port = server.clientPort;
      var cmd2 = generateCommand(self, host, port);
      exec(cmd2, function(err, stdout, stderr) {
        if (err) {
          logger.error("command %s execute with error: %j", cmd2, err.stack);
          self.invokeCallback(cb, "error");
        } else if (stdout.trim() !== "0") {
          self.invokeCallback(cb, "busy");
        } else {
          self.invokeCallback(cb, "leisure");
        }
      });
    }
  });
};

/**
 * 判断是否是本地的服务器
 */
utils.isLocal = function(host) {
  var app = require("../pomelo").app;
  if (!app) {
    return (
      host === "127.0.0.1" ||
      host === "localhost" ||
      host === "0.0.0.0" ||
      inLocal(host)
    );
  } else {
    return (
      host === "127.0.0.1" ||
      host === "localhost" ||
      host === "0.0.0.0" ||
      inLocal(host) ||
      host === app.master.host
    );
  }
};

/**
 * Load cluster server.
 *
 */
utils.loadCluster = function(app, server, serverMap) {
  var increaseFields = {};
  var host = server.host;
  var count = parseInt(server[Constants.RESERVED.CLUSTER_COUNT]);
  var seq = app.clusterSeq[server.serverType];
  if (!seq) {
    seq = 0;
    app.clusterSeq[server.serverType] = count;
  } else {
    app.clusterSeq[server.serverType] = seq + count;
  }

  for (var key in server) {
    var value = server[key].toString();
    if (value.indexOf(Constants.RESERVED.CLUSTER_SIGNAL) > 0) {
      var base = server[key].slice(0, -2);
      increaseFields[key] = base;
    }
  }

  var clone = function(src) {
    var rs = {};
    for (var key in src) {
      rs[key] = src[key];
    }
    return rs;
  };
  for (var i = 0, l = seq; i < count; i++, l++) {
    var cserver = clone(server);
    cserver.id =
      Constants.RESERVED.CLUSTER_PREFIX + server.serverType + "-" + l;
    for (var k in increaseFields) {
      var v = parseInt(increaseFields[k]);
      cserver[k] = v + i;
    }
    serverMap[cserver.id] = cserver;
  }
};

/**
 * 将add中的属性覆盖到origin上
 *
 * @param {*} origin
 * @param {*} add
 */
utils.extends = function(origin, add) {
  if (!add || !this.isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

/**
 * 读取buffer前面四个字节代表的数字
 * @param {*} headBuffer
 */
utils.headHandler = function(headBuffer) {
  var len = 0;
  for (var i = 1; i < 4; i++) {
    if (i > 1) {
      len <<= 8;
    }
    len += headBuffer.readUInt8(i);
  }
  return len;
};

/**
 * 从本地服务器的列表中查找host是否存在
 *
 * @param {*} host
 */
var inLocal = function(host) {
  for (var index in localIps) {
    if (host === localIps[index]) {
      return true;
    }
  }
  return false;
};

/**
 * 从网络接口interface 获取本机可能的所有ipv4地址
 */
var localIps = (function() {
  var ifaces = os.networkInterfaces();
  var ips = [];
  var func = function(details) {
    if (details.family === "IPv4") {
      ips.push(details.address);
    }
  };
  for (var dev in ifaces) {
    ifaces[dev].forEach(func);
  }
  return ips;
})();

/**
 * 是否是obj
 * @param {*} arg
 */
utils.isObject = function(arg) {
  return typeof arg === "object" && arg !== null;
};
