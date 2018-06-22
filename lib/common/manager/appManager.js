var async = require("async");
var utils = require("../../util/utils");
var logger = require("pomelo-logger").getLogger("pomelo", __filename);
var transactionLogger = require("pomelo-logger").getLogger(
  "transaction-log",
  __filename
);
var transactionErrorLogger = require("pomelo-logger").getLogger(
  "transaction-error-log",
  __filename
);

var manager = module.exports;

/**
 * 注册transaction
 *
 * @param {*} name
 * @param {*} conditions
 * @param {*} handlers
 * @param {*} retry
 */
manager.transaction = function(name, conditions, handlers, retry) {
  if (!retry) {
    retry = 1;
  }
  if (typeof name !== "string") {
    logger.error("transaction name is error format, name: %s.", name);
    return;
  }
  if (typeof conditions !== "object" || typeof handlers !== "object") {
    logger.error(
      "transaction conditions parameter is error format, conditions: %j, handlers: %j.",
      conditions,
      handlers
    );
    return;
  }

  var cmethods = [],
    dmethods = [],
    cnames = [],
    dnames = [];
  for (var key in conditions) {
    if (typeof key !== "string" || typeof conditions[key] !== "function") {
      logger.error(
        "transaction conditions parameter is error format, condition name: %s, condition function: %j.",
        key,
        conditions[key]
      );
      return;
    }
    cnames.push(key);
    cmethods.push(conditions[key]);
  }

  var i = 0;
  // 顺序执行条件
  // execute conditions
  async.forEachSeries(
    cmethods,
    function(method, cb) {
      method(cb);
      transactionLogger.info(
        "[%s]:[%s] condition is executed.",
        name,
        cnames[i]
      );
      i++;
    },
    function(err) {
      // 判断条件时出错
      if (err) {
        process.nextTick(function() {
          transactionLogger.error(
            "[%s]:[%s] condition is executed with err: %j.",
            name,
            cnames[--i],
            err.stack
          );
          var log = {
            name: name,
            method: cnames[i],
            time: Date.now(),
            type: "condition",
            description: err.stack
          };
          transactionErrorLogger.error(JSON.stringify(log));
        });
        return;
      } else {
        // 条件判断完成 执行handler
        // execute handlers
        process.nextTick(function() {
          for (var key in handlers) {
            if (
              typeof key !== "string" ||
              typeof handlers[key] !== "function"
            ) {
              logger.error(
                "transcation handlers parameter is error format, handler name: %s, handler function: %j.",
                key,
                handlers[key]
              );
              return;
            }
            dnames.push(key);
            dmethods.push(handlers[key]);
          }

          var flag = true;
          var times = retry;

          // do retry if failed util retry times
          async.whilst(
            // while条件
            function() {
              return retry > 0 && flag;
            },
            // 循环体
            // 循环顺序执行所有handlers直至所有handlers都执行成功
            function(callback) {
              var j = 0;
              retry--;
              async.forEachSeries(
                dmethods,
                function(method, cb) {
                  method(cb);
                  transactionLogger.info(
                    "[%s]:[%s] handler is executed.",
                    name,
                    dnames[j]
                  );
                  j++;
                },
                function(err) {
                  if (err) {
                    process.nextTick(function() {
                      transactionLogger.error(
                        "[%s]:[%s]:[%s] handler is executed with err: %j.",
                        name,
                        dnames[--j],
                        times - retry,
                        err.stack
                      );
                      var log = {
                        name: name,
                        method: dnames[j],
                        retry: times - retry,
                        time: Date.now(),
                        type: "handler",
                        description: err.stack
                      };
                      transactionErrorLogger.error(JSON.stringify(log));
                      utils.invokeCallback(callback);
                    });
                    return;
                  }
                  flag = false;
                  utils.invokeCallback(callback);
                  process.nextTick(function() {
                    transactionLogger.info(
                      "[%s] all conditions and handlers are executed successfully.",
                      name
                    );
                  });
                }
              );
            },
            // whilst执行完成后
            function(err) {
              if (err) {
                logger.error(
                  "transaction process is executed with error: %j",
                  err
                );
              }
              // callback will not pass error
            }
          );
        });
      }
    }
  );
};
