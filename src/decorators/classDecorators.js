"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
function Entity() {
    return (constructor) => {
        return class extends constructor {
        };
    };
}
exports.Entity = Entity;
//# sourceMappingURL=classDecorators.js.map