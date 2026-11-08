"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrismaClientClass = getPrismaClientClass;
const runtime = __importStar(require("@prisma/client/runtime/client"));
const config = {
    "previewFeatures": [],
    "clientVersion": "7.10.1",
    "engineVersion": "d1b3f377ca835d73fd50954a5e22128b9ebdd6b8",
    "activeProvider": "postgresql",
    "inlineSchema": "generator client {\n  provider = \"prisma-client\"\n  output   = \"../src/generated/prisma\"\n}\n\ndatasource db {\n  provider = \"postgresql\"\n}\n\nmodel Profile {\n  id               String    @id @db.Uuid // same id as auth.users\n  email            String    @unique\n  firstName        String    @default(\"\") @map(\"first_name\")\n  lastName         String    @default(\"\") @map(\"last_name\")\n  termsAcceptedAt  DateTime? @map(\"terms_accepted_at\")\n  termsVersion     String?   @map(\"terms_version\")\n  companyName      String?   @map(\"company_name\")\n  businessType     String?   @map(\"business_type\")\n  location         String?\n  profileCompleted Boolean   @default(false) @map(\"profile_completed\")\n  createdAt        DateTime  @default(now()) @map(\"created_at\")\n  updatedAt        DateTime  @updatedAt @map(\"updated_at\")\n\n  @@map(\"profiles\")\n}\n",
    "runtimeDataModel": {
        "models": {},
        "enums": {},
        "types": {}
    },
    "parameterizationSchema": {
        "strings": [],
        "graph": ""
    }
};
config.runtimeDataModel = JSON.parse("{\"models\":{\"Profile\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"email\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"firstName\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"first_name\"},{\"name\":\"lastName\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"last_name\"},{\"name\":\"termsAcceptedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"terms_accepted_at\"},{\"name\":\"termsVersion\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"terms_version\"},{\"name\":\"companyName\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"company_name\"},{\"name\":\"businessType\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"business_type\"},{\"name\":\"location\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"profileCompleted\",\"kind\":\"scalar\",\"type\":\"Boolean\",\"dbName\":\"profile_completed\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"created_at\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"updated_at\"}],\"dbName\":\"profiles\",\"schema\":null}},\"enums\":{},\"types\":{}}");
config.parameterizationSchema = {
    strings: JSON.parse("[\"where\",\"Profile.findUnique\",\"Profile.findUniqueOrThrow\",\"orderBy\",\"cursor\",\"Profile.findFirst\",\"Profile.findFirstOrThrow\",\"Profile.findMany\",\"data\",\"Profile.createOne\",\"Profile.createMany\",\"Profile.createManyAndReturn\",\"Profile.updateOne\",\"Profile.updateMany\",\"Profile.updateManyAndReturn\",\"create\",\"update\",\"Profile.upsertOne\",\"Profile.deleteOne\",\"Profile.deleteMany\",\"having\",\"_count\",\"_min\",\"_max\",\"Profile.groupBy\",\"Profile.aggregate\",\"AND\",\"OR\",\"NOT\",\"id\",\"email\",\"firstName\",\"lastName\",\"termsAcceptedAt\",\"termsVersion\",\"companyName\",\"businessType\",\"location\",\"profileCompleted\",\"createdAt\",\"updatedAt\",\"equals\",\"in\",\"notIn\",\"lt\",\"lte\",\"gt\",\"gte\",\"not\",\"contains\",\"startsWith\",\"endsWith\",\"set\"]"),
    graph: "PgkQDxoAAC4AMBsAAAQAEBwAAC4AMB0BAAAAAR4BAAAAAR8BADAAISABADAAISFAADEAISIBADIAISMBADIAISQBADIAISUBADIAISYgADMAISdAADQAIShAADQAIQEAAAABACABAAAAAQAgDxoAAC4AMBsAAAQAEBwAAC4AMB0BAC8AIR4BADAAIR8BADAAISABADAAISFAADEAISIBADIAISMBADIAISQBADIAISUBADIAISYgADMAISdAADQAIShAADQAIQUhAAA2ACAiAAA2ACAjAAA2ACAkAAA2ACAlAAA2ACADAAAABAAgAwAABQAwBAAAAQAgAwAAAAQAIAMAAAUAMAQAAAEAIAMAAAAEACADAAAFADAEAAABACAMHQEAAAABHgEAAAABHwEAAAABIAEAAAABIUAAAAABIgEAAAABIwEAAAABJAEAAAABJQEAAAABJiAAAAABJ0AAAAABKEAAAAABAQgAAAkAIAwdAQAAAAEeAQAAAAEfAQAAAAEgAQAAAAEhQAAAAAEiAQAAAAEjAQAAAAEkAQAAAAElAQAAAAEmIAAAAAEnQAAAAAEoQAAAAAEBCAAACwAwAQgAAAsAMAwdAQA6ACEeAQA6ACEfAQA6ACEgAQA6ACEhQAA7ACEiAQA8ACEjAQA8ACEkAQA8ACElAQA8ACEmIAA9ACEnQAA-ACEoQAA-ACECAAAAAQAgCAAADgAgDB0BADoAIR4BADoAIR8BADoAISABADoAISFAADsAISIBADwAISMBADwAISQBADwAISUBADwAISYgAD0AISdAAD4AIShAAD4AIQIAAAAEACAIAAAQACACAAAABAAgCAAAEAAgAwAAAAEAIA8AAAkAIBAAAA4AIAEAAAABACABAAAABAAgCBUAADcAIBYAADkAIBcAADgAICEAADYAICIAADYAICMAADYAICQAADYAICUAADYAIA8aAAAaADAbAAAXABAcAAAaADAdAQAbACEeAQAcACEfAQAcACEgAQAcACEhQAAdACEiAQAeACEjAQAeACEkAQAeACElAQAeACEmIAAfACEnQAAgACEoQAAgACEDAAAABAAgAwAAFgAwFAAAFwAgAwAAAAQAIAMAAAUAMAQAAAEAIA8aAAAaADAbAAAXABAcAAAaADAdAQAbACEeAQAcACEfAQAcACEgAQAcACEhQAAdACEiAQAeACEjAQAeACEkAQAeACElAQAeACEmIAAfACEnQAAgACEoQAAgACELFQAAIgAgFgAALAAgFwAALAAgKQEAAAABKgEAAAAEKwEAAAAELAEAAAABLQEAAAABLgEAAAABLwEAAAABMAEALQAhDhUAACIAIBYAACwAIBcAACwAICkBAAAAASoBAAAABCsBAAAABCwBAAAAAS0BAAAAAS4BAAAAAS8BAAAAATABACsAITEBAAAAATIBAAAAATMBAAAAAQsVAAAnACAWAAAqACAXAAAqACApQAAAAAEqQAAAAAUrQAAAAAUsQAAAAAEtQAAAAAEuQAAAAAEvQAAAAAEwQAApACEOFQAAJwAgFgAAKAAgFwAAKAAgKQEAAAABKgEAAAAFKwEAAAAFLAEAAAABLQEAAAABLgEAAAABLwEAAAABMAEAJgAhMQEAAAABMgEAAAABMwEAAAABBRUAACIAIBYAACUAIBcAACUAICkgAAAAATAgACQAIQsVAAAiACAWAAAjACAXAAAjACApQAAAAAEqQAAAAAQrQAAAAAQsQAAAAAEtQAAAAAEuQAAAAAEvQAAAAAEwQAAhACELFQAAIgAgFgAAIwAgFwAAIwAgKUAAAAABKkAAAAAEK0AAAAAELEAAAAABLUAAAAABLkAAAAABL0AAAAABMEAAIQAhCCkCAAAAASoCAAAABCsCAAAABCwCAAAAAS0CAAAAAS4CAAAAAS8CAAAAATACACIAIQgpQAAAAAEqQAAAAAQrQAAAAAQsQAAAAAEtQAAAAAEuQAAAAAEvQAAAAAEwQAAjACEFFQAAIgAgFgAAJQAgFwAAJQAgKSAAAAABMCAAJAAhAikgAAAAATAgACUAIQ4VAAAnACAWAAAoACAXAAAoACApAQAAAAEqAQAAAAUrAQAAAAUsAQAAAAEtAQAAAAEuAQAAAAEvAQAAAAEwAQAmACExAQAAAAEyAQAAAAEzAQAAAAEIKQIAAAABKgIAAAAFKwIAAAAFLAIAAAABLQIAAAABLgIAAAABLwIAAAABMAIAJwAhCykBAAAAASoBAAAABSsBAAAABSwBAAAAAS0BAAAAAS4BAAAAAS8BAAAAATABACgAITEBAAAAATIBAAAAATMBAAAAAQsVAAAnACAWAAAqACAXAAAqACApQAAAAAEqQAAAAAUrQAAAAAUsQAAAAAEtQAAAAAEuQAAAAAEvQAAAAAEwQAApACEIKUAAAAABKkAAAAAFK0AAAAAFLEAAAAABLUAAAAABLkAAAAABL0AAAAABMEAAKgAhDhUAACIAIBYAACwAIBcAACwAICkBAAAAASoBAAAABCsBAAAABCwBAAAAAS0BAAAAAS4BAAAAAS8BAAAAATABACsAITEBAAAAATIBAAAAATMBAAAAAQspAQAAAAEqAQAAAAQrAQAAAAQsAQAAAAEtAQAAAAEuAQAAAAEvAQAAAAEwAQAsACExAQAAAAEyAQAAAAEzAQAAAAELFQAAIgAgFgAALAAgFwAALAAgKQEAAAABKgEAAAAEKwEAAAAELAEAAAABLQEAAAABLgEAAAABLwEAAAABMAEALQAhDxoAAC4AMBsAAAQAEBwAAC4AMB0BAC8AIR4BADAAIR8BADAAISABADAAISFAADEAISIBADIAISMBADIAISQBADIAISUBADIAISYgADMAISdAADQAIShAADQAIQgpAQAAAAEqAQAAAAQrAQAAAAQsAQAAAAEtAQAAAAEuAQAAAAEvAQAAAAEwAQA1ACELKQEAAAABKgEAAAAEKwEAAAAELAEAAAABLQEAAAABLgEAAAABLwEAAAABMAEALAAhMQEAAAABMgEAAAABMwEAAAABCClAAAAAASpAAAAABStAAAAABSxAAAAAAS1AAAAAAS5AAAAAAS9AAAAAATBAACoAIQspAQAAAAEqAQAAAAUrAQAAAAUsAQAAAAEtAQAAAAEuAQAAAAEvAQAAAAEwAQAoACExAQAAAAEyAQAAAAEzAQAAAAECKSAAAAABMCAAJQAhCClAAAAAASpAAAAABCtAAAAABCxAAAAAAS1AAAAAAS5AAAAAAS9AAAAAATBAACMAIQgpAQAAAAEqAQAAAAQrAQAAAAQsAQAAAAEtAQAAAAEuAQAAAAEvAQAAAAEwAQA1ACEAAAAAATQBAAAAAQE0QAAAAAEBNAEAAAABATQgAAAAAQE0QAAAAAEAAAAAAxUABhYABxcACAAAAAMVAAYWAAcXAAgBAgECAwEFBgEGBwEHCAEJCgEKDAILDQMMDwENEQIOEgQREwESFAETFQIYGAUZGQk"
};
async function decodeBase64AsWasm(wasmBase64) {
    const { Buffer } = await import('node:buffer');
    const wasmArray = Buffer.from(wasmBase64, 'base64');
    return new WebAssembly.Module(wasmArray);
}
config.compilerWasm = {
    getRuntime: async () => await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.js"),
    getQueryCompilerWasmModule: async () => {
        const { wasm } = await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.js");
        return await decodeBase64AsWasm(wasm);
    },
    importName: "./query_compiler_fast_bg.js"
};
function getPrismaClientClass() {
    return runtime.getPrismaClient(config);
}
//# sourceMappingURL=class.js.map