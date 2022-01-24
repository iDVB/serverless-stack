var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __reExport = (target, module2, copyDefault, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && (copyDefault || key !== "default"))
        __defProp(target, key, { get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable });
  }
  return target;
};
var __toESM = (module2, isNodeMode) => {
  return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", !isNodeMode && module2 && module2.__esModule ? { get: () => module2.default, enumerable: true } : { value: module2, enumerable: true })), module2);
};
var __toCommonJS = /* @__PURE__ */ ((cache) => {
  return (module2, temp) => {
    return cache && cache.get(module2) || (temp = __reExport(__markAsModule({}), module2, 1), cache && cache.set(module2, temp), temp);
  };
})(typeof WeakMap !== "undefined" ? /* @__PURE__ */ new WeakMap() : 0);

// stacks/index.js
var stacks_exports = {};
__export(stacks_exports, {
  default: () => main
});

// stacks/MyStack.js
var s3 = __toESM(require("aws-cdk-lib/aws-s3"));
var sst = __toESM(require("@serverless-stack/resources"));
var MyStack = class extends sst.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);
    const bucket = new s3.Bucket(this, "TestBucket");
    new sst.EdgeFunction(this, "EdgeFunction", {
      handler: "src/lambda-stub.handler",
      distribution: bucket
    });
  }
};

// stacks/index.js
function main(app) {
  app.setDefaultFunctionProps({
    runtime: "nodejs14.x"
  });
  new MyStack(app, "my-stack");
}
module.exports = __toCommonJS(stacks_exports);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {});
//# sourceMappingURL=index.js.map
