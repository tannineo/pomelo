var cp = require("child_process");
var logger = require("pomelo-logger").getLogger("pomelo", __filename);
var starter = module.exports;
var util = require("util");
var utils = require("../util/utils");
var Constants = require("../util/constants");
var env = Constants.RESERVED.ENV_DEV;
var os = require("os");
var cpus = {};
var pomelo = require("../pomelo");

/**
 * Run all servers
 *
 * @param {Object} app current application  context
 * @return {Void}
 */
starter.runServers = function(app) {
  var server, servers;
  var condition = app.startId || app.type;
  switch (condition) {
    case Constants.RESERVED.MASTER:
      break;
    case Constants.RESERVED.ALL:
      servers = app.getServersFromConfig();
      for (var serverId in servers) {
        this.run(app, servers[serverId]);
      }
      break;
    default:
      server = app.getServerFromConfig(condition);
      if (!!server) {
        this.run(app, server);
      } else {
        servers = app.get(Constants.RESERVED.SERVERS)[condition];
        for (var i = 0; i < servers.length; i++) {
          this.run(app, servers[i]);
        }
      }
  }
};

/**
 * Run server
 *
 * @param {Object} app current application context
 * @param {Object} server
 * @return {Void}
 */
starter.run = function(app, server, cb) {
  env = app.get(Constants.RESERVED.ENV);
  var cmd, key;
  if (utils.isLocal(server.host)) {
    // 本地启动
    // 构建配置
    var options = [];
    if (!!server.args) {
      if (typeof server.args === "string") {
        options.push(server.args.trim());
      } else {
        options = options.concat(server.args);
      }
    }
    cmd = app.get(Constants.RESERVED.MAIN);
    options.push(cmd);
    options.push(util.format("env=%s", env));
    for (key in server) {
      if (key === Constants.RESERVED.CPU) {
        cpus[server.id] = server[key];
      }
      options.push(util.format("%s=%s", key, server[key]));
    }
    starter.localrun(process.execPath, null, options, cb);
  } else {
    // 远程启动
    // 构建配置
    cmd = util.format('cd "%s" && "%s"', app.getBase(), process.execPath);
    var arg = server.args;
    if (arg !== undefined) {
      cmd += arg;
    }
    cmd += util.format(' "%s" env=%s ', app.get(Constants.RESERVED.MAIN), env);
    for (key in server) {
      if (key === Constants.RESERVED.CPU) {
        cpus[server.id] = server[key];
      }
      cmd += util.format(" %s=%s ", key, server[key]);
    }
    starter.sshrun(cmd, server.host, cb);
  }
};

/**
 * 将进程与cpu绑定 或者说调度cpu
 * Bind process with cpu
 *
 * @param {String} sid server id
 * @param {String} pid process id
 * @param {String} host server host
 * @return {Void}
 */
starter.bindCpu = function(sid, pid, host) {
  if (os.platform() === Constants.PLATFORM.LINUX && cpus[sid] !== undefined) {
    if (utils.isLocal(host)) {
      var options = [];
      options.push("-pc");
      options.push(cpus[sid]);
      options.push(pid);
      starter.localrun(Constants.COMMAND.TASKSET, null, options);
    } else {
      var cmd = util.format('taskset -pc "%s" "%s"', cpus[sid], pid);
      starter.sshrun(cmd, host, null);
    }
  }
};

/**
 * 从服务器中干掉 pid
 * 这里传入的pids和servers 顺序是对应的
 * 从这个方法可以看出 pomelo支持的集群要么全是linux/unix 要么全是windows
 * Kill application in all servers
 *
 * @param {String} pids  array of server's pid
 * @param {String} serverIds array of serverId
 */
starter.kill = function(pids, servers) {
  var cmd;
  for (var i = 0; i < servers.length; i++) {
    var server = servers[i];
    if (utils.isLocal(server.host)) {
      var options = [];
      if (os.platform() === Constants.PLATFORM.WIN) {
        cmd = Constants.COMMAND.TASKKILL;
        options.push("/pid");
        options.push("/f");
      } else {
        cmd = Constants.COMMAND.KILL;
        options.push(-9);
      }
      options.push(pids[i]);
      starter.localrun(cmd, null, options);
    } else {
      if (os.platform() === Constants.PLATFORM.WIN) {
        cmd = util.format("taskkill /pid %s /f", pids[i]);
      } else {
        cmd = util.format("kill -9 %s", pids[i]);
      }
      starter.sshrun(cmd, server.host);
    }
  }
};

/**
 * Use ssh to run command.
 *
 * @param {String} cmd command that would be executed in the remote server
 * @param {String} host remote server host
 * @param {Function} cb callback function
 *
 */
starter.sshrun = function(cmd, host, cb) {
  var args = [];
  args.push(host);
  var ssh_params = pomelo.app.get(Constants.RESERVED.SSH_CONFIG_PARAMS);
  if (!!ssh_params && Array.isArray(ssh_params)) {
    args = args.concat(ssh_params);
  }
  args.push(cmd);

  logger.info("Executing " + cmd + " on " + host + ":22");
  spawnProcess(Constants.COMMAND.SSH, host, args, cb);
  return;
};

/**
 * Run local command.
 *
 * @param {String} cmd
 * @param {Callback} callback
 *
 */
starter.localrun = function(cmd, host, options, callback) {
  logger.info("Executing " + cmd + " " + options + " locally");
  spawnProcess(cmd, host, options, callback);
};

/**
 * Fork child process to run command.
 *
 * @param {String} command
 * @param {Object} options
 * @param {Callback} callback
 *
 */
var spawnProcess = function(command, host, options, cb) {
  var child = null;

  if (env === Constants.RESERVED.ENV_DEV) {
    // 开发环境
    child = cp.spawn(command, options);
    var prefix = command === Constants.COMMAND.SSH ? "[" + host + "] " : "";

    // 将子进程的stderr写入当前的stderr
    child.stderr.on("data", function(chunk) {
      var msg = chunk.toString();
      process.stderr.write(msg);
      if (!!cb) {
        cb(msg);
      }
    });

    // 将子进程的stdout写入当前的stdout
    child.stdout.on("data", function(chunk) {
      var msg = prefix + chunk.toString();
      process.stdout.write(msg);
    });
  } else {
    // 非开发环境
    child = cp.spawn(command, options, { detached: true, stdio: "inherit" });
    child.unref();
  }

  child.on("exit", function(code) {
    if (code !== 0) {
      logger.warn(
        "child process exit with error, error code: %s, executed command: %s",
        code,
        command
      );
    }
    if (typeof cb === "function") {
      cb(code === 0 ? null : code);
    }
  });
};
