module.exports = (function() {
    var Module = {};

    var moduleOverrides = {};
    for (var key in Module) {
        if (Module.hasOwnProperty(key)) {
            moduleOverrides[key] = Module[key]
        }
    }

    Module["read"] = function read(url) {
        var xhr = new XMLHttpRequest;
        xhr.open("GET", url, false);
        xhr.send(null);
        return xhr.responseText
    };
    if (typeof arguments != "undefined") {
        Module["arguments"] = arguments
    }
    if (typeof console !== "undefined") {
        if (!Module["print"]) Module["print"] = function print(x) {
            console.log(x)
        };
        if (!Module["printErr"]) Module["printErr"] = function printErr(x) {
            console.log(x)
        }
    } else {
        var TRY_USE_DUMP = false;
        if (!Module["print"]) Module["print"] = TRY_USE_DUMP && typeof dump !== "undefined" ? (function(x) {
            dump(x)
        }) : (function(x) {})
    }

    function globalEval(x) {
        eval.call(null, x)
    }
    if (!Module["load"] && Module["read"]) {
        Module["load"] = function load(f) {
            globalEval(Module["read"](f))
        }
    }
    if (!Module["print"]) {
        Module["print"] = (function() {})
    }
    if (!Module["printErr"]) {
        Module["printErr"] = Module["print"]
    }
    if (!Module["arguments"]) {
        Module["arguments"] = []
    }
    if (!Module["thisProgram"]) {
        Module["thisProgram"] = "./this.program"
    }
    Module.print = Module["print"];
    Module.printErr = Module["printErr"];
    Module["preRun"] = [];
    Module["postRun"] = [];
    for (var key in moduleOverrides) {
        if (moduleOverrides.hasOwnProperty(key)) {
            Module[key] = moduleOverrides[key]
        }
    }
    var Runtime = {
        setTempRet0: (function(value) {
            tempRet0 = value
        }),
        getTempRet0: (function() {
            return tempRet0
        }),
        stackSave: (function() {
            return STACKTOP
        }),
        stackRestore: (function(stackTop) {
            STACKTOP = stackTop
        }),
        getNativeTypeSize: (function(type) {
            switch (type) {
                case "i1":
                case "i8":
                    return 1;
                case "i16":
                    return 2;
                case "i32":
                    return 4;
                case "i64":
                    return 8;
                case "float":
                    return 4;
                case "double":
                    return 8;
                default:
                    {
                        if (type[type.length - 1] === "*") {
                            return Runtime.QUANTUM_SIZE
                        } else if (type[0] === "i") {
                            var bits = parseInt(type.substr(1));
                            assert(bits % 8 === 0);
                            return bits / 8
                        } else {
                            return 0
                        }
                    }
            }
        }),
        getNativeFieldSize: (function(type) {
            return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE)
        }),
        STACK_ALIGN: 16,
        getAlignSize: (function(type, size, vararg) {
            if (!vararg && (type == "i64" || type == "double")) return 8;
            if (!type) return Math.min(size, 8);
            return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE)
        }),
        dynCall: (function(sig, ptr, args) {
            if (args && args.length) {
                if (!args.splice) args = Array.prototype.slice.call(args);
                args.splice(0, 0, ptr);
                return Module["dynCall_" + sig].apply(null, args)
            } else {
                return Module["dynCall_" + sig].call(null, ptr)
            }
        }),
        functionPointers: [],
        addFunction: (function(func) {
            for (var i = 0; i < Runtime.functionPointers.length; i++) {
                if (!Runtime.functionPointers[i]) {
                    Runtime.functionPointers[i] = func;
                    return 2 * (1 + i)
                }
            }
            throw "Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS."
        }),
        removeFunction: (function(index) {
            Runtime.functionPointers[(index - 2) / 2] = null
        }),
        getAsmConst: (function(code, numArgs) {
            if (!Runtime.asmConstCache) Runtime.asmConstCache = {};
            var func = Runtime.asmConstCache[code];
            if (func) return func;
            var args = [];
            for (var i = 0; i < numArgs; i++) {
                args.push(String.fromCharCode(36) + i)
            }
            var source = Pointer_stringify(code);
            if (source[0] === '"') {
                if (source.indexOf('"', 1) === source.length - 1) {
                    source = source.substr(1, source.length - 2)
                } else {
                    abort("invalid EM_ASM input |" + source + "|. Please use EM_ASM(..code..) (no quotes) or EM_ASM({ ..code($0).. }, input) (to input values)")
                }
            }
            try {
                var evalled = eval("(function(Module, FS) { return function(" + args.join(",") + "){ " + source + " } })")(Module, typeof FS !== "undefined" ? FS : null)
            } catch (e) {
                Module.printErr("error in executing inline EM_ASM code: " + e + " on: \n\n" + source + "\n\nwith args |" + args + "| (make sure to use the right one out of EM_ASM, EM_ASM_ARGS, etc.)");
                throw e
            }
            return Runtime.asmConstCache[code] = evalled
        }),
        warnOnce: (function(text) {
            if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
            if (!Runtime.warnOnce.shown[text]) {
                Runtime.warnOnce.shown[text] = 1;
                Module.printErr(text)
            }
        }),
        funcWrappers: {},
        getFuncWrapper: (function(func, sig) {
            assert(sig);
            if (!Runtime.funcWrappers[sig]) {
                Runtime.funcWrappers[sig] = {}
            }
            var sigCache = Runtime.funcWrappers[sig];
            if (!sigCache[func]) {
                sigCache[func] = function dynCall_wrapper() {
                    return Runtime.dynCall(sig, func, arguments)
                }
            }
            return sigCache[func]
        }),
        UTF8Processor: (function() {
            var buffer = [];
            var needed = 0;
            this.processCChar = (function(code) {
                code = code & 255;
                if (buffer.length == 0) {
                    if ((code & 128) == 0) {
                        return String.fromCharCode(code)
                    }
                    buffer.push(code);
                    if ((code & 224) == 192) {
                        needed = 1
                    } else if ((code & 240) == 224) {
                        needed = 2
                    } else {
                        needed = 3
                    }
                    return ""
                }
                if (needed) {
                    buffer.push(code);
                    needed--;
                    if (needed > 0) return ""
                }
                var c1 = buffer[0];
                var c2 = buffer[1];
                var c3 = buffer[2];
                var c4 = buffer[3];
                var ret;
                if (buffer.length == 2) {
                    ret = String.fromCharCode((c1 & 31) << 6 | c2 & 63)
                } else if (buffer.length == 3) {
                    ret = String.fromCharCode((c1 & 15) << 12 | (c2 & 63) << 6 | c3 & 63)
                } else {
                    var codePoint = (c1 & 7) << 18 | (c2 & 63) << 12 | (c3 & 63) << 6 | c4 & 63;
                    ret = String.fromCharCode(((codePoint - 65536) / 1024 | 0) + 55296, (codePoint - 65536) % 1024 + 56320)
                }
                buffer.length = 0;
                return ret
            });
            this.processJSString = function processJSString(string) {
                string = unescape(encodeURIComponent(string));
                var ret = [];
                for (var i = 0; i < string.length; i++) {
                    ret.push(string.charCodeAt(i))
                }
                return ret
            }
        }),
        getCompilerSetting: (function(name) {
            throw "You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work"
        }),
        stackAlloc: (function(size) {
            var ret = STACKTOP;
            STACKTOP = STACKTOP + size | 0;
            STACKTOP = STACKTOP + 15 & -16;
            return ret
        }),
        staticAlloc: (function(size) {
            var ret = STATICTOP;
            STATICTOP = STATICTOP + size | 0;
            STATICTOP = STATICTOP + 15 & -16;
            return ret
        }),
        dynamicAlloc: (function(size) {
            var ret = DYNAMICTOP;
            DYNAMICTOP = DYNAMICTOP + size | 0;
            DYNAMICTOP = DYNAMICTOP + 15 & -16;
            if (DYNAMICTOP >= TOTAL_MEMORY) enlargeMemory();
            return ret
        }),
        alignMemory: (function(size, quantum) {
            var ret = size = Math.ceil(size / (quantum ? quantum : 16)) * (quantum ? quantum : 16);
            return ret
        }),
        makeBigInt: (function(low, high, unsigned) {
            var ret = unsigned ? +(low >>> 0) + +(high >>> 0) * +4294967296 : +(low >>> 0) + +(high | 0) * +4294967296;
            return ret
        }),
        GLOBAL_BASE: 8,
        QUANTUM_SIZE: 4,
        __dummy__: 0
    };
    Module["Runtime"] = Runtime;
    var __THREW__ = 0;
    var ABORT = false;
    var EXITSTATUS = 0;
    var undef = 0;
    var tempValue, tempInt, tempBigInt, tempInt2, tempBigInt2, tempPair, tempBigIntI, tempBigIntR, tempBigIntS, tempBigIntP, tempBigIntD, tempDouble, tempFloat;
    var tempI64, tempI64b;
    var tempRet0, tempRet1, tempRet2, tempRet3, tempRet4, tempRet5, tempRet6, tempRet7, tempRet8, tempRet9;

    function assert(condition, text) {
        if (!condition) {
            abort("Assertion failed: " + text)
        }
    }
    var globalScope = this;

    function getCFunc(ident) {
        var func = Module["_" + ident];
        if (!func) {
            try {
                func = eval("_" + ident)
            } catch (e) {}
        }
        assert(func, "Cannot call unknown function " + ident + " (perhaps LLVM optimizations or closure removed it?)");
        return func
    }
    var cwrap, ccall;
    ((function() {
        var stack = 0;
        var JSfuncs = {
            "stackSave": (function() {
                stack = Runtime.stackSave()
            }),
            "stackRestore": (function() {
                Runtime.stackRestore(stack)
            }),
            "arrayToC": (function(arr) {
                var ret = Runtime.stackAlloc(arr.length);
                writeArrayToMemory(arr, ret);
                return ret
            }),
            "stringToC": (function(str) {
                var ret = 0;
                if (str !== null && str !== undefined && str !== 0) {
                    ret = Runtime.stackAlloc((str.length << 2) + 1);
                    writeStringToMemory(str, ret)
                }
                return ret
            })
        };
        var toC = {
            "string": JSfuncs["stringToC"],
            "array": JSfuncs["arrayToC"]
        };
        ccall = function ccallFunc(ident, returnType, argTypes, args) {
            var func = getCFunc(ident);
            var cArgs = [];
            if (args) {
                for (var i = 0; i < args.length; i++) {
                    var converter = toC[argTypes[i]];
                    if (converter) {
                        if (stack === 0) stack = Runtime.stackSave();
                        cArgs[i] = converter(args[i])
                    } else {
                        cArgs[i] = args[i]
                    }
                }
            }
            var ret = func.apply(null, cArgs);
            if (returnType === "string") ret = Pointer_stringify(ret);
            if (stack !== 0) JSfuncs["stackRestore"]();
            return ret
        };
        var sourceRegex = /^function\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;

        function parseJSFunc(jsfunc) {
            var parsed = jsfunc.toString().match(sourceRegex).slice(1);
            return {
                arguments: parsed[0],
                body: parsed[1],
                returnValue: parsed[2]
            }
        }
        var JSsource = {};
        for (var fun in JSfuncs) {
            if (JSfuncs.hasOwnProperty(fun)) {
                JSsource[fun] = parseJSFunc(JSfuncs[fun])
            }
        }
        cwrap = function cwrap(ident, returnType, argTypes) {
            argTypes = argTypes || [];
            var cfunc = getCFunc(ident);
            var numericArgs = argTypes.every((function(type) {
                return type === "number"
            }));
            var numericRet = returnType !== "string";
            if (numericRet && numericArgs) {
                return cfunc
            }
            var argNames = argTypes.map((function(x, i) {
                return "$" + i
            }));
            var funcstr = "(function(" + argNames.join(",") + ") {";
            var nargs = argTypes.length;
            if (!numericArgs) {
                funcstr += JSsource["stackSave"].body + ";";
                for (var i = 0; i < nargs; i++) {
                    var arg = argNames[i],
                        type = argTypes[i];
                    if (type === "number") continue;
                    var convertCode = JSsource[type + "ToC"];
                    funcstr += "var " + convertCode.arguments + " = " + arg + ";";
                    funcstr += convertCode.body + ";";
                    funcstr += arg + "=" + convertCode.returnValue + ";"
                }
            }
            var cfuncname = parseJSFunc((function() {
                return cfunc
            })).returnValue;
            funcstr += "var ret = " + cfuncname + "(" + argNames.join(",") + ");";
            if (!numericRet) {
                var strgfy = parseJSFunc((function() {
                    return Pointer_stringify
                })).returnValue;
                funcstr += "ret = " + strgfy + "(ret);"
            }
            if (!numericArgs) {
                funcstr += JSsource["stackRestore"].body + ";"
            }
            funcstr += "return ret})";
            return eval(funcstr)
        }
    }))();
    Module["cwrap"] = cwrap;
    Module["ccall"] = ccall;

    function setValue(ptr, value, type, noSafe) {
        type = type || "i8";
        if (type.charAt(type.length - 1) === "*") type = "i32";
        switch (type) {
            case "i1":
                HEAP8[ptr >> 0] = value;
                break;
            case "i8":
                HEAP8[ptr >> 0] = value;
                break;
            case "i16":
                HEAP16[ptr >> 1] = value;
                break;
            case "i32":
                HEAP32[ptr >> 2] = value;
                break;
            case "i64":
                tempI64 = [value >>> 0, (tempDouble = value, +Math_abs(tempDouble) >= +1 ? tempDouble > +0 ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / +4294967296) >>> 0 : 0)], HEAP32[ptr >> 2] = tempI64[0], HEAP32[ptr + 4 >> 2] = tempI64[1];
                break;
            case "float":
                HEAPF32[ptr >> 2] = value;
                break;
            case "double":
                HEAPF64[ptr >> 3] = value;
                break;
            default:
                abort("invalid type for setValue: " + type)
        }
    }
    Module["setValue"] = setValue;

    function getValue(ptr, type, noSafe) {
        type = type || "i8";
        if (type.charAt(type.length - 1) === "*") type = "i32";
        switch (type) {
            case "i1":
                return HEAP8[ptr >> 0];
            case "i8":
                return HEAP8[ptr >> 0];
            case "i16":
                return HEAP16[ptr >> 1];
            case "i32":
                return HEAP32[ptr >> 2];
            case "i64":
                return HEAP32[ptr >> 2];
            case "float":
                return HEAPF32[ptr >> 2];
            case "double":
                return HEAPF64[ptr >> 3];
            default:
                abort("invalid type for setValue: " + type)
        }
        return null
    }
    Module["getValue"] = getValue;
    var ALLOC_NORMAL = 0;
    var ALLOC_STACK = 1;
    var ALLOC_STATIC = 2;
    var ALLOC_DYNAMIC = 3;
    var ALLOC_NONE = 4;
    Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
    Module["ALLOC_STACK"] = ALLOC_STACK;
    Module["ALLOC_STATIC"] = ALLOC_STATIC;
    Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
    Module["ALLOC_NONE"] = ALLOC_NONE;

    function allocate(slab, types, allocator, ptr) {
        var zeroinit, size;
        if (typeof slab === "number") {
            zeroinit = true;
            size = slab
        } else {
            zeroinit = false;
            size = slab.length
        }
        var singleType = typeof types === "string" ? types : null;
        var ret;
        if (allocator == ALLOC_NONE) {
            ret = ptr
        } else {
            ret = [_malloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length))
        }
        if (zeroinit) {
            var ptr = ret,
                stop;
            assert((ret & 3) == 0);
            stop = ret + (size & ~3);
            for (; ptr < stop; ptr += 4) {
                HEAP32[ptr >> 2] = 0
            }
            stop = ret + size;
            while (ptr < stop) {
                HEAP8[ptr++ >> 0] = 0
            }
            return ret
        }
        if (singleType === "i8") {
            if (slab.subarray || slab.slice) {
                HEAPU8.set(slab, ret)
            } else {
                HEAPU8.set(new Uint8Array(slab), ret)
            }
            return ret
        }
        var i = 0,
            type, typeSize, previousType;
        while (i < size) {
            var curr = slab[i];
            if (typeof curr === "function") {
                curr = Runtime.getFunctionIndex(curr)
            }
            type = singleType || types[i];
            if (type === 0) {
                i++;
                continue
            }
            if (type == "i64") type = "i32";
            setValue(ret + i, curr, type);
            if (previousType !== type) {
                typeSize = Runtime.getNativeTypeSize(type);
                previousType = type
            }
            i += typeSize
        }
        return ret
    }
    Module["allocate"] = allocate;

    function demangleAll(text) {
        return text
    }

    function jsStackTrace() {
        var err = new Error;
        if (!err.stack) {
            try {
                throw new Error(0)
            } catch (e) {
                err = e
            }
            if (!err.stack) {
                return "(no stack trace available)"
            }
        }
        return err.stack.toString()
    }

    function stackTrace() {
        return demangleAll(jsStackTrace())
    }
    Module["stackTrace"] = stackTrace;
    var PAGE_SIZE = 4096;

    function alignMemoryPage(x) {
        return x + 4095 & -4096
    }
    var HEAP;
    var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
    var STATIC_BASE = 0,
        STATICTOP = 0,
        staticSealed = false;
    var STACK_BASE = 0,
        STACKTOP = 0,
        STACK_MAX = 0;
    var DYNAMIC_BASE = 0,
        DYNAMICTOP = 0;

    function enlargeMemory() {
        abort("Cannot enlarge memory arrays. Either (1) compile with -s TOTAL_MEMORY=X with X higher than the current value " + TOTAL_MEMORY + ", (2) compile with ALLOW_MEMORY_GROWTH which adjusts the size at runtime but prevents some optimizations, or (3) set Module.TOTAL_MEMORY before the program runs.")
    }
    var TOTAL_STACK = Module["TOTAL_STACK"] || 5242880;
    var TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 33554432;
    var FAST_MEMORY = Module["FAST_MEMORY"] || 2097152;
    var totalMemory = 64 * 1024;
    while (totalMemory < TOTAL_MEMORY || totalMemory < 2 * TOTAL_STACK) {
        if (totalMemory < 16 * 1024 * 1024) {
            totalMemory *= 2
        } else {
            totalMemory += 16 * 1024 * 1024
        }
    }
    if (totalMemory !== TOTAL_MEMORY) {
        Module.printErr("increasing TOTAL_MEMORY to " + totalMemory + " to be compliant with the asm.js spec");
        TOTAL_MEMORY = totalMemory
    }
    assert(typeof Int32Array !== "undefined" && typeof Float64Array !== "undefined" && !!(new Int32Array(1))["subarray"] && !!(new Int32Array(1))["set"], "JS engine does not provide full typed array support");
    var buffer = new ArrayBuffer(TOTAL_MEMORY);
    HEAP8 = new Int8Array(buffer);
    HEAP16 = new Int16Array(buffer);
    HEAP32 = new Int32Array(buffer);
    HEAPU8 = new Uint8Array(buffer);
    HEAPU16 = new Uint16Array(buffer);
    HEAPU32 = new Uint32Array(buffer);
    HEAPF32 = new Float32Array(buffer);
    HEAPF64 = new Float64Array(buffer);
    HEAP32[0] = 255;
    assert(HEAPU8[0] === 255 && HEAPU8[3] === 0, "Typed arrays 2 must be run on a little-endian system");
    Module["HEAP"] = HEAP;
    Module["buffer"] = buffer;
    Module["HEAP8"] = HEAP8;
    Module["HEAP16"] = HEAP16;
    Module["HEAP32"] = HEAP32;
    Module["HEAPU8"] = HEAPU8;
    Module["HEAPU16"] = HEAPU16;
    Module["HEAPU32"] = HEAPU32;
    Module["HEAPF32"] = HEAPF32;
    Module["HEAPF64"] = HEAPF64;

    function callRuntimeCallbacks(callbacks) {
        while (callbacks.length > 0) {
            var callback = callbacks.shift();
            if (typeof callback == "function") {
                callback();
                continue
            }
            var func = callback.func;
            if (typeof func === "number") {
                if (callback.arg === undefined) {
                    Runtime.dynCall("v", func)
                } else {
                    Runtime.dynCall("vi", func, [callback.arg])
                }
            } else {
                func(callback.arg === undefined ? null : callback.arg)
            }
        }
    }
    var __ATPRERUN__ = [];
    var __ATINIT__ = [];
    var __ATMAIN__ = [];
    var __ATEXIT__ = [];
    var __ATPOSTRUN__ = [];
    var runtimeInitialized = false;
    var runtimeExited = false;

    function preRun() {
        if (Module["preRun"]) {
            if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
            while (Module["preRun"].length) {
                addOnPreRun(Module["preRun"].shift())
            }
        }
        callRuntimeCallbacks(__ATPRERUN__)
    }

    function ensureInitRuntime() {
        if (runtimeInitialized) return;
        runtimeInitialized = true;
        callRuntimeCallbacks(__ATINIT__)
    }

    function preMain() {
        callRuntimeCallbacks(__ATMAIN__)
    }

    function exitRuntime() {
        callRuntimeCallbacks(__ATEXIT__);
        runtimeExited = true
    }

    function postRun() {
        if (Module["postRun"]) {
            if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
            while (Module["postRun"].length) {
                addOnPostRun(Module["postRun"].shift())
            }
        }
        callRuntimeCallbacks(__ATPOSTRUN__)
    }

    function addOnPreRun(cb) {
        __ATPRERUN__.unshift(cb)
    }
    Module["addOnPreRun"] = Module.addOnPreRun = addOnPreRun;

    function addOnInit(cb) {
        __ATINIT__.unshift(cb)
    }
    Module["addOnInit"] = Module.addOnInit = addOnInit;

    function addOnPreMain(cb) {
        __ATMAIN__.unshift(cb)
    }
    Module["addOnPreMain"] = Module.addOnPreMain = addOnPreMain;

    function addOnExit(cb) {
        __ATEXIT__.unshift(cb)
    }
    Module["addOnExit"] = Module.addOnExit = addOnExit;

    function addOnPostRun(cb) {
        __ATPOSTRUN__.unshift(cb)
    }
    Module["addOnPostRun"] = Module.addOnPostRun = addOnPostRun;

    function intArrayFromString(stringy, dontAddNull, length) {
        var ret = (new Runtime.UTF8Processor).processJSString(stringy);
        if (length) {
            ret.length = length
        }
        if (!dontAddNull) {
            ret.push(0)
        }
        return ret
    }
    Module["intArrayFromString"] = intArrayFromString;

    function intArrayToString(array) {
        var ret = [];
        for (var i = 0; i < array.length; i++) {
            var chr = array[i];
            if (chr > 255) {
                chr &= 255
            }
            ret.push(String.fromCharCode(chr))
        }
        return ret.join("")
    }
    Module["intArrayToString"] = intArrayToString;

    function writeStringToMemory(string, buffer, dontAddNull) {
        var array = intArrayFromString(string, dontAddNull);
        var i = 0;
        while (i < array.length) {
            var chr = array[i];
            HEAP8[buffer + i >> 0] = chr;
            i = i + 1
        }
    }
    Module["writeStringToMemory"] = writeStringToMemory;

    function writeArrayToMemory(array, buffer) {
        for (var i = 0; i < array.length; i++) {
            HEAP8[buffer + i >> 0] = array[i]
        }
    }
    Module["writeArrayToMemory"] = writeArrayToMemory;

    function writeAsciiToMemory(str, buffer, dontAddNull) {
        for (var i = 0; i < str.length; i++) {
            HEAP8[buffer + i >> 0] = str.charCodeAt(i)
        }
        if (!dontAddNull) HEAP8[buffer + str.length >> 0] = 0
    }
    Module["writeAsciiToMemory"] = writeAsciiToMemory;

    function unSign(value, bits, ignore) {
        if (value >= 0) {
            return value
        }
        return bits <= 32 ? 2 * Math.abs(1 << bits - 1) + value : Math.pow(2, bits) + value
    }

    function reSign(value, bits, ignore) {
        if (value <= 0) {
            return value
        }
        var half = bits <= 32 ? Math.abs(1 << bits - 1) : Math.pow(2, bits - 1);
        if (value >= half && (bits <= 32 || value > half)) {
            value = -2 * half + value
        }
        return value
    }
    if (!Math["imul"] || Math["imul"](4294967295, 5) !== -5) Math["imul"] = function imul(a, b) {
        var ah = a >>> 16;
        var al = a & 65535;
        var bh = b >>> 16;
        var bl = b & 65535;
        return al * bl + (ah * bl + al * bh << 16) | 0
    };
    Math.imul = Math["imul"];
    var Math_abs = Math.abs;
    var Math_cos = Math.cos;
    var Math_sin = Math.sin;
    var Math_tan = Math.tan;
    var Math_acos = Math.acos;
    var Math_asin = Math.asin;
    var Math_atan = Math.atan;
    var Math_atan2 = Math.atan2;
    var Math_exp = Math.exp;
    var Math_log = Math.log;
    var Math_sqrt = Math.sqrt;
    var Math_ceil = Math.ceil;
    var Math_floor = Math.floor;
    var Math_pow = Math.pow;
    var Math_imul = Math.imul;
    var Math_fround = Math.fround;
    var Math_min = Math.min;
    var runDependencies = 0;
    var runDependencyWatcher = null;
    var dependenciesFulfilled = null;

    function addRunDependency(id) {
        runDependencies++;
        if (Module["monitorRunDependencies"]) {
            Module["monitorRunDependencies"](runDependencies)
        }
    }
    Module["addRunDependency"] = addRunDependency;

    function removeRunDependency(id) {
        runDependencies--;
        if (Module["monitorRunDependencies"]) {
            Module["monitorRunDependencies"](runDependencies)
        }
        if (runDependencies == 0) {
            if (runDependencyWatcher !== null) {
                clearInterval(runDependencyWatcher);
                runDependencyWatcher = null
            }
            if (dependenciesFulfilled) {
                var callback = dependenciesFulfilled;
                dependenciesFulfilled = null;
                callback()
            }
        }
    }
    Module["removeRunDependency"] = removeRunDependency;
    Module["preloadedImages"] = {};
    Module["preloadedAudios"] = {};
    var memoryInitializer = null;
    STATIC_BASE = 8;
    STATICTOP = STATIC_BASE + 6304;
    __ATINIT__.push();
    allocate([0, 0, 1, 0, 1, 2, 0, 1, 2, 3, 1, 2, 3, 2, 3, 3, 0, 1, 0, 2, 1, 0, 3, 2, 1, 0, 3, 2, 1, 3, 2, 3, 0, 0, 1, 0, 1, 2, 0, 1, 2, 3, 0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6, 7, 1, 2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7, 3, 4, 5, 6, 7, 4, 5, 6, 7, 5, 6, 7, 6, 7, 7, 0, 1, 0, 2, 1, 0, 3, 2, 1, 0, 4, 3, 2, 1, 0, 5, 4, 3, 2, 1, 0, 6, 5, 4, 3, 2, 1, 0, 7, 6, 5, 4, 3, 2, 1, 0, 7, 6, 5, 4, 3, 2, 1, 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 7, 6, 5, 4, 7, 6, 5, 7, 6, 7, 40, 45, 51, 57, 64, 72, 0, 0, 29, 0, 0, 0, 30, 0, 0, 0, 31, 0, 0, 0, 32, 0, 0, 0, 33, 0, 0, 0, 33, 0, 0, 0, 34, 0, 0, 0, 34, 0, 0, 0, 35, 0, 0, 0, 35, 0, 0, 0, 36, 0, 0, 0, 36, 0, 0, 0, 37, 0, 0, 0, 37, 0, 0, 0, 0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 10, 10, 10, 10, 10, 10, 11, 11, 11, 11, 11, 11, 12, 12, 0, 0, 0, 0, 0, 0, 0, 2, 5, 9, 1, 4, 8, 12, 3, 7, 11, 14, 6, 10, 13, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 3, 0, 0, 0, 0, 0, 2, 5, 9, 14, 20, 27, 35, 1, 4, 8, 13, 19, 26, 34, 42, 3, 7, 12, 18, 25, 33, 41, 48, 6, 11, 17, 24, 32, 40, 47, 53, 10, 16, 23, 31, 39, 46, 52, 57, 15, 22, 30, 38, 45, 51, 56, 60, 21, 29, 37, 44, 50, 55, 59, 62, 28, 36, 43, 49, 54, 58, 61, 63, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 0, 1, 2, 3, 16, 17, 18, 19, 4, 5, 6, 7, 20, 21, 22, 23, 8, 9, 10, 11, 24, 25, 26, 27, 12, 13, 14, 15, 28, 29, 30, 31, 32, 33, 34, 35, 48, 49, 50, 51, 36, 37, 38, 39, 52, 53, 54, 55, 40, 41, 42, 43, 56, 57, 58, 59, 44, 45, 46, 47, 60, 61, 62, 63, 0, 1, 4, 5, 2, 3, 4, 5, 6, 6, 8, 8, 7, 7, 8, 8, 1, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 0, 0, 2, 1, 0, 0, 2, 1, 0, 0, 2, 1, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 153, 200, 139, 141, 157, 154, 154, 154, 154, 154, 154, 154, 154, 184, 154, 154, 154, 184, 63, 139, 154, 154, 154, 154, 154, 154, 154, 154, 154, 154, 154, 154, 154, 154, 154, 154, 154, 153, 138, 138, 111, 141, 94, 138, 182, 154, 139, 139, 139, 139, 139, 139, 110, 110, 124, 125, 140, 153, 125, 127, 140, 109, 111, 143, 127, 111, 79, 108, 123, 63, 110, 110, 124, 125, 140, 153, 125, 127, 140, 109, 111, 143, 127, 111, 79, 108, 123, 63, 91, 171, 134, 141, 111, 111, 125, 110, 110, 94, 124, 108, 124, 107, 125, 141, 179, 153, 125, 107, 125, 141, 179, 153, 125, 107, 125, 141, 179, 153, 125, 140, 139, 182, 182, 152, 136, 152, 136, 153, 136, 139, 111, 136, 139, 111, 141, 111, 140, 92, 137, 138, 140, 152, 138, 139, 153, 74, 149, 92, 139, 107, 122, 152, 140, 179, 166, 182, 140, 227, 122, 197, 138, 153, 136, 167, 152, 152, 154, 154, 154, 154, 154, 154, 154, 154, 154, 154, 154, 154, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 153, 185, 107, 139, 126, 154, 197, 185, 201, 154, 154, 154, 149, 154, 139, 154, 154, 154, 152, 139, 110, 122, 95, 79, 63, 31, 31, 153, 153, 153, 153, 140, 198, 140, 198, 168, 79, 124, 138, 94, 153, 111, 149, 107, 167, 154, 139, 139, 139, 139, 139, 139, 125, 110, 94, 110, 95, 79, 125, 111, 110, 78, 110, 111, 111, 95, 94, 108, 123, 108, 125, 110, 94, 110, 95, 79, 125, 111, 110, 78, 110, 111, 111, 95, 94, 108, 123, 108, 121, 140, 61, 154, 155, 154, 139, 153, 139, 123, 123, 63, 153, 166, 183, 140, 136, 153, 154, 166, 183, 140, 136, 153, 154, 166, 183, 140, 136, 153, 154, 170, 153, 123, 123, 107, 121, 107, 121, 167, 151, 183, 140, 151, 183, 140, 140, 140, 154, 196, 196, 167, 154, 152, 167, 182, 182, 134, 149, 136, 153, 121, 136, 137, 169, 194, 166, 167, 154, 167, 137, 182, 107, 167, 91, 122, 107, 167, 154, 154, 154, 154, 154, 154, 154, 154, 154, 154, 154, 154, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 153, 160, 107, 139, 126, 154, 197, 185, 201, 154, 154, 154, 134, 154, 139, 154, 154, 183, 152, 139, 154, 137, 95, 79, 63, 31, 31, 153, 153, 153, 153, 169, 198, 169, 198, 168, 79, 224, 167, 122, 153, 111, 149, 92, 167, 154, 139, 139, 139, 139, 139, 139, 125, 110, 124, 110, 95, 94, 125, 111, 111, 79, 125, 126, 111, 111, 79, 108, 123, 93, 125, 110, 124, 110, 95, 94, 125, 111, 111, 79, 125, 126, 111, 111, 79, 108, 123, 93, 121, 140, 61, 154, 170, 154, 139, 153, 139, 123, 123, 63, 124, 166, 183, 140, 136, 153, 154, 166, 183, 140, 136, 153, 154, 166, 183, 140, 136, 153, 154, 170, 153, 138, 138, 122, 121, 122, 121, 167, 151, 183, 140, 151, 183, 140, 140, 140, 154, 196, 167, 167, 154, 152, 167, 182, 182, 134, 149, 136, 153, 121, 136, 122, 169, 208, 166, 167, 154, 152, 167, 182, 107, 167, 91, 107, 107, 167, 154, 154, 154, 154, 154, 154, 154, 154, 154, 154, 154, 154, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 6, 6, 7, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22, 24, 0, 0, 29, 30, 31, 32, 33, 33, 34, 34, 35, 35, 36, 36, 37, 37, 0, 0, 0, 0, 0, 0, 1, 0, 2, 0, 3, 0, 0, 0, 4, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9, 0, 0, 0, 0, 0, 0, 0, 104, 101, 118, 99, 0, 0, 0, 0, 200, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 53, 54, 50, 72, 34, 48, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100, 30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 26, 10, 1, 0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 3, 5, 7, 8, 10, 12, 13, 15, 17, 18, 19, 20, 21, 22, 23, 23, 24, 24, 25, 25, 26, 27, 27, 28, 28, 29, 29, 30, 31, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 32, 26, 21, 17, 13, 9, 5, 2, 0, 254, 251, 247, 243, 239, 235, 230, 224, 230, 235, 239, 243, 247, 251, 254, 0, 2, 5, 9, 13, 17, 21, 26, 32, 0, 0, 0, 0, 0, 0, 0, 0, 240, 154, 249, 114, 252, 138, 253, 30, 254, 122, 254, 197, 254, 0, 255, 197, 254, 122, 254, 30, 254, 138, 253, 114, 252, 154, 249, 0, 240, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 64, 90, 90, 90, 89, 88, 87, 85, 83, 82, 80, 78, 75, 73, 70, 67, 64, 61, 57, 54, 50, 46, 43, 38, 36, 31, 25, 22, 18, 13, 9, 4, 254, 58, 10, 254, 252, 54, 16, 254, 250, 46, 28, 252, 252, 36, 36, 252, 252, 28, 46, 250, 254, 16, 54, 252, 254, 10, 58, 254, 0, 0, 0, 0, 255, 4, 246, 58, 17, 251, 1, 0, 255, 4, 246, 58, 17, 251, 1, 0, 255, 4, 245, 40, 40, 245, 4, 255, 255, 4, 245, 40, 40, 245, 4, 255, 0, 1, 251, 17, 58, 246, 4, 255, 0, 1, 251, 17, 58, 246, 4, 255, 1, 2, 0, 3, 4, 0, 0, 0, 255, 0, 1, 0, 0, 255, 0, 1, 255, 255, 1, 1, 1, 255, 255, 1, 0, 1, 1, 0, 0, 2, 2, 0, 1, 2, 2, 1, 0, 3, 3, 0, 1, 3, 3, 1, 2, 3, 3, 2, 16, 16, 16, 16, 17, 18, 21, 24, 16, 16, 16, 16, 17, 19, 22, 25, 16, 16, 17, 18, 20, 22, 25, 29, 16, 16, 18, 21, 24, 27, 31, 36, 17, 17, 20, 24, 30, 35, 41, 47, 18, 19, 22, 27, 35, 44, 54, 65, 21, 22, 25, 31, 41, 54, 70, 88, 24, 25, 29, 36, 47, 65, 88, 115, 16, 16, 16, 16, 17, 18, 20, 24, 16, 16, 16, 17, 18, 20, 24, 25, 16, 16, 17, 18, 20, 24, 25, 28, 16, 17, 18, 20, 24, 25, 28, 33, 17, 18, 20, 24, 25, 28, 33, 41, 18, 20, 24, 25, 28, 33, 41, 54, 20, 24, 25, 28, 33, 41, 54, 71, 24, 25, 28, 33, 41, 54, 71, 91, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 176, 208, 240, 128, 167, 197, 227, 128, 158, 187, 216, 123, 150, 178, 205, 116, 142, 169, 195, 111, 135, 160, 185, 105, 128, 152, 175, 100, 122, 144, 166, 95, 116, 137, 158, 90, 110, 130, 150, 85, 104, 123, 142, 81, 99, 117, 135, 77, 94, 111, 128, 73, 89, 105, 122, 69, 85, 100, 116, 66, 80, 95, 110, 62, 76, 90, 104, 59, 72, 86, 99, 56, 69, 81, 94, 53, 65, 77, 89, 51, 62, 73, 85, 48, 59, 69, 80, 46, 56, 66, 76, 43, 53, 63, 72, 41, 50, 59, 69, 39, 48, 56, 65, 37, 45, 54, 62, 35, 43, 51, 59, 33, 41, 48, 56, 32, 39, 46, 53, 30, 37, 43, 50, 29, 35, 41, 48, 27, 33, 39, 45, 26, 31, 37, 43, 24, 30, 35, 41, 23, 28, 33, 39, 22, 27, 32, 37, 21, 26, 30, 35, 20, 24, 29, 33, 19, 23, 27, 31, 18, 22, 26, 30, 17, 21, 25, 28, 16, 20, 23, 27, 15, 19, 22, 25, 14, 18, 21, 24, 14, 17, 20, 23, 13, 16, 19, 22, 12, 15, 18, 21, 12, 14, 17, 20, 11, 14, 16, 19, 11, 13, 15, 18, 10, 12, 15, 17, 10, 12, 14, 16, 9, 11, 13, 15, 9, 11, 12, 14, 8, 10, 12, 14, 8, 9, 11, 13, 7, 9, 11, 12, 7, 9, 10, 12, 7, 8, 10, 11, 6, 8, 9, 11, 6, 7, 9, 10, 6, 7, 8, 9, 2, 2, 2, 2, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 62, 63, 0, 0, 1, 2, 2, 4, 4, 5, 6, 7, 8, 9, 9, 11, 11, 12, 13, 13, 15, 15, 16, 16, 18, 18, 19, 19, 21, 21, 22, 22, 23, 24, 24, 25, 26, 26, 27, 27, 28, 29, 29, 30, 30, 30, 31, 32, 32, 33, 33, 33, 34, 34, 35, 35, 35, 36, 36, 36, 37, 37, 37, 38, 38, 63, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 0, 255, 255, 255, 127, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 0, 0, 0, 0, 0, 0, 0, 0, 3, 1, 1, 0, 36, 56, 37, 56, 38, 56, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 3, 1, 0, 16, 36, 56, 37, 56, 38, 56, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 16, 36, 56, 37, 56, 38, 56, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 36, 56, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);
    var tempDoublePtr = Runtime.alignMemory(allocate(12, "i8", ALLOC_STATIC), 8);
    assert(tempDoublePtr % 8 == 0);

    function copyTempFloat(ptr) {
        HEAP8[tempDoublePtr] = HEAP8[ptr];
        HEAP8[tempDoublePtr + 1] = HEAP8[ptr + 1];
        HEAP8[tempDoublePtr + 2] = HEAP8[ptr + 2];
        HEAP8[tempDoublePtr + 3] = HEAP8[ptr + 3]
    }

    function copyTempDouble(ptr) {
        HEAP8[tempDoublePtr] = HEAP8[ptr];
        HEAP8[tempDoublePtr + 1] = HEAP8[ptr + 1];
        HEAP8[tempDoublePtr + 2] = HEAP8[ptr + 2];
        HEAP8[tempDoublePtr + 3] = HEAP8[ptr + 3];
        HEAP8[tempDoublePtr + 4] = HEAP8[ptr + 4];
        HEAP8[tempDoublePtr + 5] = HEAP8[ptr + 5];
        HEAP8[tempDoublePtr + 6] = HEAP8[ptr + 6];
        HEAP8[tempDoublePtr + 7] = HEAP8[ptr + 7]
    }
    Module["_bitshift64Ashr"] = _bitshift64Ashr;
    Module["_i64Subtract"] = _i64Subtract;

    function _sbrk(bytes) {
        var self = _sbrk;
        if (!self.called) {
            DYNAMICTOP = alignMemoryPage(DYNAMICTOP);
            self.called = true;
            assert(Runtime.dynamicAlloc);
            self.alloc = Runtime.dynamicAlloc;
            Runtime.dynamicAlloc = (function() {
                abort("cannot dynamically allocate, sbrk now has control")
            })
        }
        var ret = DYNAMICTOP;
        if (bytes != 0) self.alloc(bytes);
        return ret
    }
    Module["_i64Add"] = _i64Add;
    Module["_strlen"] = _strlen;
    Module["_memset"] = _memset;
    Module["_bitshift64Shl"] = _bitshift64Shl;

    function _abort() {
        Module["abort"]()
    }
    Module["_llvm_bswap_i32"] = _llvm_bswap_i32;

    function _rint(x) {
        if (Math.abs(x % 1) !== .5) return Math.round(x);
        return x + x % 2 + (x < 0 ? 1 : -1)
    }

    function _lrint() {
        return _rint.apply(null, arguments)
    }

    function _emscripten_memcpy_big(dest, src, num) {
        HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
        return dest
    }
    Module["_memcpy"] = _memcpy;
    STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);
    staticSealed = true;
    STACK_MAX = STACK_BASE + TOTAL_STACK;
    DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);
    assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");
    var ctlz_i8 = allocate([8, 7, 6, 6, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "i8", ALLOC_DYNAMIC);
    var cttz_i8 = allocate([8, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 6, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 7, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 6, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0], "i8", ALLOC_DYNAMIC);

    function invoke_iiii(index, a1, a2, a3) {
        try {
            return Module["dynCall_iiii"](index, a1, a2, a3)
        } catch (e) {
            if (typeof e !== "number" && e !== "longjmp") throw e;
            asm["setThrew"](1, 0)
        }
    }

    function invoke_viiiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11) {
        try {
            Module["dynCall_viiiiiiiiiii"](index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11)
        } catch (e) {
            if (typeof e !== "number" && e !== "longjmp") throw e;
            asm["setThrew"](1, 0)
        }
    }

    function invoke_viiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) {
        try {
            Module["dynCall_viiiiiiiiii"](index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10)
        } catch (e) {
            if (typeof e !== "number" && e !== "longjmp") throw e;
            asm["setThrew"](1, 0)
        }
    }

    function invoke_viiiii(index, a1, a2, a3, a4, a5) {
        try {
            Module["dynCall_viiiii"](index, a1, a2, a3, a4, a5)
        } catch (e) {
            if (typeof e !== "number" && e !== "longjmp") throw e;
            asm["setThrew"](1, 0)
        }
    }

    function invoke_vi(index, a1) {
        try {
            Module["dynCall_vi"](index, a1)
        } catch (e) {
            if (typeof e !== "number" && e !== "longjmp") throw e;
            asm["setThrew"](1, 0)
        }
    }

    function invoke_vii(index, a1, a2) {
        try {
            Module["dynCall_vii"](index, a1, a2)
        } catch (e) {
            if (typeof e !== "number" && e !== "longjmp") throw e;
            asm["setThrew"](1, 0)
        }
    }

    function invoke_iiiiiii(index, a1, a2, a3, a4, a5, a6) {
        try {
            return Module["dynCall_iiiiiii"](index, a1, a2, a3, a4, a5, a6)
        } catch (e) {
            if (typeof e !== "number" && e !== "longjmp") throw e;
            asm["setThrew"](1, 0)
        }
    }

    function invoke_viiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
        try {
            Module["dynCall_viiiiiiiii"](index, a1, a2, a3, a4, a5, a6, a7, a8, a9)
        } catch (e) {
            if (typeof e !== "number" && e !== "longjmp") throw e;
            asm["setThrew"](1, 0)
        }
    }

    function invoke_viiiiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12) {
        try {
            Module["dynCall_viiiiiiiiiiii"](index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12)
        } catch (e) {
            if (typeof e !== "number" && e !== "longjmp") throw e;
            asm["setThrew"](1, 0)
        }
    }

    function invoke_ii(index, a1) {
        try {
            return Module["dynCall_ii"](index, a1)
        } catch (e) {
            if (typeof e !== "number" && e !== "longjmp") throw e;
            asm["setThrew"](1, 0)
        }
    }

    function invoke_viii(index, a1, a2, a3) {
        try {
            Module["dynCall_viii"](index, a1, a2, a3)
        } catch (e) {
            if (typeof e !== "number" && e !== "longjmp") throw e;
            asm["setThrew"](1, 0)
        }
    }

    function invoke_viiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8) {
        try {
            Module["dynCall_viiiiiiii"](index, a1, a2, a3, a4, a5, a6, a7, a8)
        } catch (e) {
            if (typeof e !== "number" && e !== "longjmp") throw e;
            asm["setThrew"](1, 0)
        }
    }

    function invoke_iiiii(index, a1, a2, a3, a4) {
        try {
            return Module["dynCall_iiiii"](index, a1, a2, a3, a4)
        } catch (e) {
            if (typeof e !== "number" && e !== "longjmp") throw e;
            asm["setThrew"](1, 0)
        }
    }

    function invoke_viiiiii(index, a1, a2, a3, a4, a5, a6) {
        try {
            Module["dynCall_viiiiii"](index, a1, a2, a3, a4, a5, a6)
        } catch (e) {
            if (typeof e !== "number" && e !== "longjmp") throw e;
            asm["setThrew"](1, 0)
        }
    }

    function invoke_iii(index, a1, a2) {
        try {
            return Module["dynCall_iii"](index, a1, a2)
        } catch (e) {
            if (typeof e !== "number" && e !== "longjmp") throw e;
            asm["setThrew"](1, 0)
        }
    }

    function invoke_iiiiii(index, a1, a2, a3, a4, a5) {
        try {
            return Module["dynCall_iiiiii"](index, a1, a2, a3, a4, a5)
        } catch (e) {
            if (typeof e !== "number" && e !== "longjmp") throw e;
            asm["setThrew"](1, 0)
        }
    }

    function invoke_viiiiiii(index, a1, a2, a3, a4, a5, a6, a7) {
        try {
            Module["dynCall_viiiiiii"](index, a1, a2, a3, a4, a5, a6, a7)
        } catch (e) {
            if (typeof e !== "number" && e !== "longjmp") throw e;
            asm["setThrew"](1, 0)
        }
    }
    Module.asmGlobalArg = {
        "Math": Math,
        "Int8Array": Int8Array,
        "Int16Array": Int16Array,
        "Int32Array": Int32Array,
        "Uint8Array": Uint8Array,
        "Uint16Array": Uint16Array,
        "Uint32Array": Uint32Array,
        "Float32Array": Float32Array,
        "Float64Array": Float64Array
    };
    Module.asmLibraryArg = {
        "abort": abort,
        "assert": assert,
        "min": Math_min,
        "invoke_iiii": invoke_iiii,
        "invoke_viiiiiiiiiii": invoke_viiiiiiiiiii,
        "invoke_viiiiiiiiii": invoke_viiiiiiiiii,
        "invoke_viiiii": invoke_viiiii,
        "invoke_vi": invoke_vi,
        "invoke_vii": invoke_vii,
        "invoke_iiiiiii": invoke_iiiiiii,
        "invoke_viiiiiiiii": invoke_viiiiiiiii,
        "invoke_viiiiiiiiiiii": invoke_viiiiiiiiiiii,
        "invoke_ii": invoke_ii,
        "invoke_viii": invoke_viii,
        "invoke_viiiiiiii": invoke_viiiiiiii,
        "invoke_iiiii": invoke_iiiii,
        "invoke_viiiiii": invoke_viiiiii,
        "invoke_iii": invoke_iii,
        "invoke_iiiiii": invoke_iiiiii,
        "invoke_viiiiiii": invoke_viiiiiii,
        "_sbrk": _sbrk,
        "_lrint": _lrint,
        "_abort": _abort,
        "_emscripten_memcpy_big": _emscripten_memcpy_big,
        "_rint": _rint,
        "STACKTOP": STACKTOP,
        "STACK_MAX": STACK_MAX,
        "tempDoublePtr": tempDoublePtr,
        "ABORT": ABORT,
        "cttz_i8": cttz_i8,
        "ctlz_i8": ctlz_i8,
        "NaN": NaN,
        "Infinity": Infinity
    }; // EMSCRIPTEN_START_ASM
    var asm = (function(global, env, buffer) {
        "use asm";
        var a = new global.Int8Array(buffer);
        var b = new global.Int16Array(buffer);
        var c = new global.Int32Array(buffer);
        var d = new global.Uint8Array(buffer);
        var e = new global.Uint16Array(buffer);
        var f = new global.Uint32Array(buffer);
        var g = new global.Float32Array(buffer);
        var h = new global.Float64Array(buffer);
        var i = env.STACKTOP | 0;
        var j = env.STACK_MAX | 0;
        var k = env.tempDoublePtr | 0;
        var l = env.ABORT | 0;
        var m = env.cttz_i8 | 0;
        var n = env.ctlz_i8 | 0;
        var o = 0;
        var p = 0;
        var q = 0;
        var r = 0;
        var s = +env.NaN,
            t = +env.Infinity;
        var u = 0,
            v = 0,
            w = 0,
            x = 0,
            y = 0.0,
            z = 0,
            A = 0,
            B = 0,
            C = 0.0;
        var D = 0;
        var E = 0;
        var F = 0;
        var G = 0;
        var H = 0;
        var I = 0;
        var J = 0;
        var K = 0;
        var L = 0;
        var M = 0;
        var N = global.Math.floor;
        var O = global.Math.abs;
        var P = global.Math.sqrt;
        var Q = global.Math.pow;
        var R = global.Math.cos;
        var S = global.Math.sin;
        var T = global.Math.tan;
        var U = global.Math.acos;
        var V = global.Math.asin;
        var W = global.Math.atan;
        var X = global.Math.atan2;
        var Y = global.Math.exp;
        var Z = global.Math.log;
        var _ = global.Math.ceil;
        var $ = global.Math.imul;
        var aa = env.abort;
        var ba = env.assert;
        var ca = env.min;
        var da = env.invoke_iiii;
        var ea = env.invoke_viiiiiiiiiii;
        var fa = env.invoke_viiiiiiiiii;
        var ga = env.invoke_viiiii;
        var ha = env.invoke_vi;
        var ia = env.invoke_vii;
        var ja = env.invoke_iiiiiii;
        var ka = env.invoke_viiiiiiiii;
        var la = env.invoke_viiiiiiiiiiii;
        var ma = env.invoke_ii;
        var na = env.invoke_viii;
        var oa = env.invoke_viiiiiiii;
        var pa = env.invoke_iiiii;
        var qa = env.invoke_viiiiii;
        var ra = env.invoke_iii;
        var sa = env.invoke_iiiiii;
        var ta = env.invoke_viiiiiii;
        var ua = env._sbrk;
        var va = env._lrint;
        var wa = env._abort;
        var xa = env._emscripten_memcpy_big;
        var ya = env._rint;
        var za = 0.0;
        // EMSCRIPTEN_START_FUNCS
        function ic(e, f, g, h, j, k, l, m, n, o, p, q, r) {
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            m = m | 0;
            n = n | 0;
            o = o | 0;
            p = p | 0;
            q = q | 0;
            r = r | 0;
            var s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                D = 0,
                E = 0,
                F = 0,
                G = 0,
                H = 0,
                I = 0,
                J = 0,
                K = 0,
                L = 0,
                M = 0;
            s = i;
            i = i + 16 | 0;
            w = s + 8 | 0;
            t = s;
            z = e + 136 | 0;
            v = c[z >> 2] | 0;
            K = c[q >> 2] | 0;
            c[w >> 2] = K;
            M = c[q + 4 >> 2] | 0;
            A = w + 4 | 0;
            c[A >> 2] = M;
            y = c[r >> 2] | 0;
            c[t >> 2] = y;
            J = c[r + 4 >> 2] | 0;
            x = t + 4 | 0;
            c[x >> 2] = J;
            q = a[v + 31254 >> 0] | 0;
            do
                if (q << 24 >> 24) {
                    if ((o | 0) == 1) {
                        c[v + 288 >> 2] = d[v + p + 31268 >> 0];
                        if ((c[(c[e + 200 >> 2] | 0) + 4 >> 2] | 0) == 3) {
                            c[v + 292 >> 2] = d[v + p + 31277 >> 0];
                            c[v + 296 >> 2] = d[v + p + 31281 >> 0];
                            break
                        } else {
                            c[v + 292 >> 2] = d[v + 31277 >> 0];
                            c[v + 296 >> 2] = d[v + 31281 >> 0];
                            break
                        }
                    }
                } else {
                    c[v + 288 >> 2] = d[v + 31268 >> 0];
                    c[v + 292 >> 2] = d[v + 31277 >> 0];
                    c[v + 296 >> 2] = d[v + 31281 >> 0]
                }
            while (0);
            r = e + 200 | 0;
            G = c[r >> 2] | 0;
            B = (c[G + 13076 >> 2] | 0) >>> 0 < n >>> 0;
            if (((!B ? (c[G + 13072 >> 2] | 0) >>> 0 < n >>> 0 : 0) ? (d[v + 31255 >> 0] | 0) > (o | 0) : 0) ? !(q << 24 >> 24 != 0 & (o | 0) == 0) : 0) q = (Gb(e, n) | 0) & 255;
            else {
                if ((c[G + 13088 >> 2] | 0) == 0 ? (c[v + 31244 >> 2] | 0) == 0 : 0) G = (o | 0) == 0 & (c[v + 31248 >> 2] | 0) != 0;
                else G = 0;
                if (B) q = 1;
                else q = (q << 24 >> 24 != 0 & (o | 0) == 0 | G) & 1
            }
            B = (n | 0) > 2;
            G = c[(c[r >> 2] | 0) + 4 >> 2] | 0;
            if (B)
                if (!G) L = y;
                else E = 20;
            else if ((G | 0) == 3) E = 20;
            else L = y;
            do
                if ((E | 0) == 20) {
                    G = (o | 0) == 0;
                    if (!((K | 0) == 0 & (G ^ 1))) {
                        K = Hb(e, o) | 0;
                        c[w >> 2] = K;
                        if ((c[(c[r >> 2] | 0) + 4 >> 2] | 0) == 2 ? q << 24 >> 24 == 0 | (n | 0) == 3 : 0) {
                            M = Hb(e, o) | 0;
                            c[A >> 2] = M
                        }
                        if (!G) E = 25
                    } else {
                        K = 0;
                        E = 25
                    }
                    if ((E | 0) == 25)
                        if (!y) {
                            L = 0;
                            break
                        }
                    L = Hb(e, o) | 0;
                    c[t >> 2] = L;
                    if ((c[(c[r >> 2] | 0) + 4 >> 2] | 0) == 2 ? q << 24 >> 24 == 0 | (n | 0) == 3 : 0) {
                        J = Hb(e, o) | 0;
                        c[x >> 2] = J
                    }
                }
            while (0);
            if (!(q << 24 >> 24)) {
                A = c[r >> 2] | 0;
                y = c[A + 13072 >> 2] | 0;
                x = 1 << y;
                q = c[A + 13148 >> 2] | 0;
                if (((o | 0) == 0 ? (c[v + 31244 >> 2] | 0) != 1 : 0) & (K | 0) == 0 & (L | 0) == 0)
                    if ((c[A + 4 >> 2] | 0) == 2 ? (M | J | 0) != 0 : 0) E = 37;
                    else o = 1;
                else E = 37;
                if ((E | 0) == 37) {
                    o = Ib(e, o) | 0;
                    A = c[r >> 2] | 0
                }
                G = c[z >> 2] | 0;
                A = n - (c[A + 13172 >> 2] | 0) | 0;
                z = G + 31244 | 0;
                if ((c[z >> 2] | 0) == 1) {
                    I = 1 << n;
                    qd(e, f, g, I, I);
                    mc(e, f, g, n, 0)
                }
                I = (o | 0) != 0;
                K = (K | L | 0) == 0;
                do
                    if (I)
                        if (K) E = 46;
                        else {
                            F = 0;
                            E = 48
                        } else
                if (K) {
                    K = c[r >> 2] | 0;
                    L = c[K + 4 >> 2] | 0;
                    if ((L | 0) == 2) {
                        if (M) {
                            E = 46;
                            break
                        }
                        if (J) {
                            M = 0;
                            E = 46;
                            break
                        }
                    }
                    if (!((c[z >> 2] | 0) != 1 | (L | 0) == 0)) {
                        if (B | (L | 0) == 3) {
                            t = 1 << (c[K + 13172 >> 2] | 0) + A;
                            w = 1 << (c[K + 13184 >> 2] | 0) + A;
                            qd(e, f, g, t, w);
                            mc(e, f, g, A, 1);
                            mc(e, f, g, A, 2);
                            if ((c[(c[r >> 2] | 0) + 4 >> 2] | 0) != 2) break;
                            M = (1 << A) + g | 0;
                            qd(e, f, M, t, w);
                            mc(e, f, M, A, 1);
                            mc(e, f, M, A, 2);
                            break
                        }
                        if ((p | 0) == 3 ? (F = 1 << n + 1, H = 1 << (c[K + 13184 >> 2] | 0) + n, qd(e, h, j, F, H), mc(e, h, j, n, 1), mc(e, h, j, n, 2), (c[(c[r >> 2] | 0) + 4 >> 2] | 0) == 2) : 0) {
                            M = (1 << n) + j | 0;
                            qd(e, h, M, F, H);
                            mc(e, h, M, n, 1);
                            mc(e, h, M, n, 2)
                        }
                    }
                } else {
                    F = 0;
                    E = 48
                }
                while (0);
                if ((E | 0) == 46)
                    if ((c[(c[r >> 2] | 0) + 4 >> 2] | 0) == 2) {
                        F = (M | J | 0) == 0;
                        E = 48
                    } else {
                        F = 1;
                        E = 48
                    }
                a: do
                    if ((E | 0) == 48) {
                        E = e + 204 | 0;
                        do
                            if ((a[(c[E >> 2] | 0) + 22 >> 0] | 0) != 0 ? (D = G + 300 | 0, (a[D >> 0] | 0) == 0) : 0) {
                                M = ob(e) | 0;
                                J = G + 280 | 0;
                                c[J >> 2] = M;
                                if (M) {
                                    M = (pb(e) | 0) == 1;
                                    H = c[J >> 2] | 0;
                                    if (M) {
                                        H = 0 - H | 0;
                                        c[J >> 2] = H
                                    }
                                } else H = 0;
                                a[D >> 0] = 1;
                                M = (c[(c[r >> 2] | 0) + 13192 >> 2] | 0) / 2 | 0;
                                if ((H | 0) < (-26 - M | 0) | (H | 0) > (M + 25 | 0)) {
                                    M = -1094995529;
                                    i = s;
                                    return M | 0
                                } else {
                                    Ob(e, k, l, m);
                                    break
                                }
                            }
                        while (0);
                        if ((!((a[e + 3068 >> 0] | 0) == 0 | F) ? (a[G + 31256 >> 0] | 0) == 0 : 0) ? (C = G + 301 | 0, (a[C >> 0] | 0) == 0) : 0) {
                            if (!(qb(e) | 0)) {
                                a[G + 302 >> 0] = 0;
                                a[G + 303 >> 0] = 0
                            } else {
                                l = c[E >> 2] | 0;
                                if (!(a[l + 1633 >> 0] | 0)) m = 0;
                                else {
                                    m = rb(e) | 0;
                                    l = c[E >> 2] | 0
                                }
                                a[G + 302 >> 0] = a[l + m + 1634 >> 0] | 0;
                                a[G + 303 >> 0] = a[(c[E >> 2] | 0) + m + 1639 >> 0] | 0
                            }
                            a[C >> 0] = 1
                        }
                        if ((c[z >> 2] | 0) == 1 & (n | 0) < 4) {
                            m = c[G + 288 >> 2] | 0;
                            if ((m + -6 | 0) >>> 0 < 9) k = 2;
                            else k = (m + -22 | 0) >>> 0 < 9 & 1;
                            m = c[G + 292 >> 2] | 0;
                            if ((m + -6 | 0) >>> 0 < 9) m = 2;
                            else m = (m + -22 | 0) >>> 0 < 9 & 1
                        } else {
                            k = 0;
                            m = 0
                        }
                        l = G + 304 | 0;
                        a[l >> 0] = 0;
                        if (I) Lb(e, f, g, n, k, 0);
                        k = c[r >> 2] | 0;
                        C = c[k + 4 >> 2] | 0;
                        if (C) {
                            if (!(B | (C | 0) == 3)) {
                                if ((p | 0) != 3) break;
                                p = 1 << n + 1;
                                A = 1 << (c[k + 13184 >> 2] | 0) + n;
                                l = 0;
                                do {
                                    if ((c[z >> 2] | 0) == 1) {
                                        M = (l << n) + j | 0;
                                        qd(e, h, M, p, A);
                                        mc(e, h, M, n, 1)
                                    }
                                    if (c[w + (l << 2) >> 2] | 0) Lb(e, h, (l << n) + j | 0, n, m, 1);
                                    l = l + 1 | 0
                                } while ((l | 0) < (((c[(c[r >> 2] | 0) + 4 >> 2] | 0) == 2 ? 2 : 1) | 0));
                                w = 0;
                                while (1) {
                                    if ((c[z >> 2] | 0) == 1) {
                                        M = (w << n) + j | 0;
                                        qd(e, h, M, p, A);
                                        mc(e, h, M, n, 2)
                                    }
                                    if (c[t + (w << 2) >> 2] | 0) Lb(e, h, (w << n) + j | 0, n, m, 2);
                                    w = w + 1 | 0;
                                    if ((w | 0) >= (((c[(c[r >> 2] | 0) + 4 >> 2] | 0) == 2 ? 2 : 1) | 0)) break a
                                }
                            }
                            h = 1 << (c[k + 13172 >> 2] | 0) + A;
                            j = 1 << (c[k + 13184 >> 2] | 0) + A;
                            do
                                if ((a[(c[E >> 2] | 0) + 1630 >> 0] | 0) == 0 | I ^ 1) a[l >> 0] = 0;
                                else {
                                    if (c[z >> 2] | 0) {
                                        M = (c[G + 296 >> 2] | 0) == 4;
                                        a[l >> 0] = M & 1;
                                        if (!M) break
                                    } else a[l >> 0] = 1;
                                    jc(e, 0)
                                }
                            while (0);
                            p = e + 160 | 0;
                            E = G + 320 | 0;
                            D = G + 11680 | 0;
                            C = 1 << A << A;
                            k = (C | 0) > 0;
                            B = e + (A + -2 << 2) + 5856 | 0;
                            F = G + 284 | 0;
                            I = 0;
                            do {
                                if ((c[z >> 2] | 0) == 1) {
                                    M = (I << A) + g | 0;
                                    qd(e, f, M, h, j);
                                    mc(e, f, M, A, 1)
                                }
                                do
                                    if (!(c[w + (I << 2) >> 2] | 0)) {
                                        if (!(a[l >> 0] | 0)) break;
                                        L = c[p >> 2] | 0;
                                        G = c[L + 36 >> 2] | 0;
                                        H = c[r >> 2] | 0;
                                        M = $(g >> c[H + 13184 >> 2], G) | 0;
                                        H = (c[L + 4 >> 2] | 0) + (M + (f >> c[H + 13172 >> 2] << c[H + 56 >> 2])) | 0;
                                        if (k) {
                                            I = 0;
                                            do {
                                                b[D + (I << 1) >> 1] = ($(b[E + (I << 1) >> 1] | 0, c[F >> 2] | 0) | 0) >>> 3;
                                                I = I + 1 | 0
                                            } while ((I | 0) != (C | 0));
                                            I = C
                                        } else I = 0;
                                        Ka[c[B >> 2] & 7](H, D, G)
                                    } else Lb(e, f, (I << A) + g | 0, A, m, 1);
                                while (0);
                                I = I + 1 | 0
                            } while ((I | 0) < (((c[(c[r >> 2] | 0) + 4 >> 2] | 0) == 2 ? 2 : 1) | 0));
                            if (!(a[l >> 0] | 0)) H = 0;
                            else {
                                jc(e, 1);
                                H = 0
                            }
                            do {
                                if ((c[z >> 2] | 0) == 1) {
                                    M = (H << A) + g | 0;
                                    qd(e, f, M, h, j);
                                    mc(e, f, M, A, 2)
                                }
                                do
                                    if (!(c[t + (H << 2) >> 2] | 0)) {
                                        if (!(a[l >> 0] | 0)) break;
                                        L = c[p >> 2] | 0;
                                        w = c[L + 40 >> 2] | 0;
                                        G = c[r >> 2] | 0;
                                        M = $(g >> c[G + 13188 >> 2], w) | 0;
                                        G = (c[L + 8 >> 2] | 0) + (M + (f >> c[G + 13176 >> 2] << c[G + 56 >> 2])) | 0;
                                        if (k) {
                                            H = 0;
                                            do {
                                                b[D + (H << 1) >> 1] = ($(b[E + (H << 1) >> 1] | 0, c[F >> 2] | 0) | 0) >>> 3;
                                                H = H + 1 | 0
                                            } while ((H | 0) != (C | 0));
                                            H = C
                                        } else H = 0;
                                        Ka[c[B >> 2] & 7](G, D, w)
                                    } else Lb(e, f, (H << A) + g | 0, A, m, 2);
                                while (0);
                                H = H + 1 | 0
                            } while ((H | 0) < (((c[(c[r >> 2] | 0) + 4 >> 2] | 0) == 2 ? 2 : 1) | 0))
                        }
                    }
                while (0);
                if ((o | 0) != 0 ? (u = 1 << n, (u | 0) > 0) : 0) {
                    t = e + 7596 | 0;
                    r = 0;
                    do {
                        w = $(r + g >> y, q) | 0;
                        h = 0;
                        do {
                            a[(c[t >> 2] | 0) + ((h + f >> y) + w) >> 0] = 1;
                            h = h + x | 0
                        } while ((h | 0) < (u | 0));
                        r = r + x | 0
                    } while ((r | 0) < (u | 0))
                }
                if (((a[e + 3049 >> 0] | 0) == 0 ? (Pb(e, f, g, n), (a[(c[e + 204 >> 2] | 0) + 40 >> 0] | 0) != 0) : 0) ? (a[v + 31256 >> 0] | 0) != 0 : 0) fc(e, f, g, n)
            } else {
                v = n + -1 | 0;
                u = 1 << v;
                n = u + f | 0;
                u = u + g | 0;
                r = o + 1 | 0;
                q = ic(e, f, g, f, g, k, l, m, v, r, 0, w, t) | 0;
                if ((q | 0) < 0) {
                    M = q;
                    i = s;
                    return M | 0
                }
                q = ic(e, n, g, f, g, k, l, m, v, r, 1, w, t) | 0;
                if ((q | 0) < 0) {
                    M = q;
                    i = s;
                    return M | 0
                }
                q = ic(e, f, u, f, g, k, l, m, v, r, 2, w, t) | 0;
                if ((q | 0) < 0) {
                    M = q;
                    i = s;
                    return M | 0
                }
                f = ic(e, n, u, f, g, k, l, m, v, r, 3, w, t) | 0;
                if ((f | 0) < 0) {
                    M = f;
                    i = s;
                    return M | 0
                }
            }
            M = 0;
            i = s;
            return M | 0
        }

        function jc(a, b) {
            a = a | 0;
            b = b | 0;
            var d = 0,
                e = 0,
                f = 0;
            d = i;
            e = c[a + 136 >> 2] | 0;
            f = Jb(a, b) | 0;
            if (!f) {
                c[e + 284 >> 2] = 0;
                i = d;
                return
            } else {
                c[e + 284 >> 2] = 1 - ((Kb(a, b) | 0) << 1) << f + -1;
                i = d;
                return
            }
        }

        function kc(e, f, g, h, j, k, l, m, n, o, p) {
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            m = m | 0;
            n = n | 0;
            o = o | 0;
            p = p | 0;
            var q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0;
            q = i;
            v = c[e + 136 >> 2] | 0;
            t = c[h >> 2] | 0;
            u = c[h + 32 >> 2] | 0;
            y = c[e + 200 >> 2] | 0;
            w = c[y + 13120 >> 2] | 0;
            x = c[y + 13124 >> 2] | 0;
            z = b[j >> 1] | 0;
            h = z & 3;
            A = b[j + 2 >> 1] | 0;
            j = A & 3;
            r = c[e + 2428 >> 2] | 0;
            if ((r | 0) == 1) r = (a[(c[e + 204 >> 2] | 0) + 37 >> 0] | 0) != 0;
            else if (!r) r = (a[(c[e + 204 >> 2] | 0) + 38 >> 0] | 0) != 0;
            else r = 0;
            s = d[1408 + m >> 0] | 0;
            k = (z << 16 >> 16 >> 2) + k | 0;
            l = (A << 16 >> 16 >> 2) + l | 0;
            A = $(l, u) | 0;
            y = c[y + 56 >> 2] | 0;
            A = A + (k << y) | 0;
            z = t + A | 0;
            if (!((!((k | 0) < 3 | (l | 0) < 4) ? (k | 0) < (-4 - m + w | 0) : 0) ? (l | 0) < (-4 - n + x | 0) : 0)) {
                B = 80 << y;
                z = 3 << y;
                A = t + (A + ($(u, -3) | 0) - z) | 0;
                Ca[c[e + 7560 >> 2] & 1](v + 320 | 0, A, B, u, m + 7 | 0, n + 7 | 0, k + -3 | 0, l + -3 | 0, w, x);
                z = v + ((B * 3 | 0) + z) + 320 | 0;
                u = B
            }
            t = (h | 0) != 0 & 1;
            v = (j | 0) != 0 & 1;
            if (r) {
                Ba[c[e + (s << 4) + (v << 3) + (t << 2) + 6248 >> 2] & 7](f, g, z, u, n, d[e + 3101 >> 0] | 0, o, p, h, j, m);
                i = q;
                return
            } else {
                La[c[e + (s << 4) + (v << 3) + (t << 2) + 6088 >> 2] & 7](f, g, z, u, n, h, j, m);
                i = q;
                return
            }
        }

        function lc(e, f, g, h, j, k, l, m, n, o, p, q, r) {
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            m = m | 0;
            n = n | 0;
            o = o | 0;
            p = p | 0;
            q = q | 0;
            r = r | 0;
            var s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                D = 0,
                E = 0;
            s = i;
            z = c[e + 136 >> 2] | 0;
            B = c[e + 200 >> 2] | 0;
            y = c[B + 13172 >> 2] | 0;
            x = c[B + 13120 >> 2] >> y;
            A = c[B + 13184 >> 2] | 0;
            w = c[B + 13124 >> 2] >> A;
            t = c[e + 2428 >> 2] | 0;
            if ((t | 0) == 1) u = (a[(c[e + 204 >> 2] | 0) + 37 >> 0] | 0) != 0;
            else if (!t) u = (a[(c[e + 204 >> 2] | 0) + 38 >> 0] | 0) != 0;
            else u = 0;
            t = d[1408 + n >> 0] | 0;
            E = b[p + (k << 2) >> 1] | 0;
            D = y + 2 | 0;
            v = E & (1 << D) + -1;
            k = b[p + (k << 2) + 2 >> 1] | 0;
            C = A + 2 | 0;
            p = k & (1 << C) + -1;
            y = v << 1 - y;
            A = p << 1 - A;
            l = (E >> D) + l | 0;
            m = (k >> C) + m | 0;
            C = $(m, j) | 0;
            k = c[B + 56 >> 2] | 0;
            C = C + (l << k) | 0;
            B = h + C | 0;
            if (!((!((l | 0) < 1 | (m | 0) < 2) ? (l | 0) < (-2 - n + x | 0) : 0) ? (m | 0) < (-2 - o + w | 0) : 0)) {
                E = 80 << k;
                B = 1 << k;
                Ca[c[e + 7560 >> 2] & 1](z + 320 | 0, h + (C - j - B) | 0, E, j, n + 3 | 0, o + 3 | 0, l + -1 | 0, m + -1 | 0, x, w);
                B = z + (E + B) + 320 | 0;
                j = E
            }
            v = (v | 0) != 0 & 1;
            w = (p | 0) != 0 & 1;
            if (u) {
                Ba[c[e + (t << 4) + (w << 3) + (v << 2) + 7048 >> 2] & 7](f, g, B, j, o, b[e + 3102 >> 1] | 0, q, r, y, A, n);
                i = s;
                return
            } else {
                La[c[e + (t << 4) + (w << 3) + (v << 2) + 6888 >> 2] & 7](f, g, B, j, o, y, A, n);
                i = s;
                return
            }
        }

        function mc(b, e, f, g, h) {
            b = b | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            var j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                D = 0,
                E = 0,
                F = 0,
                G = 0,
                H = 0,
                I = 0,
                J = 0,
                K = 0,
                L = 0,
                M = 0,
                N = 0,
                O = 0,
                P = 0,
                Q = 0,
                R = 0,
                S = 0,
                T = 0,
                U = 0,
                V = 0,
                W = 0,
                X = 0,
                Y = 0,
                Z = 0,
                _ = 0,
                aa = 0,
                ba = 0,
                ca = 0,
                da = 0,
                ea = 0,
                fa = 0,
                ga = 0,
                ha = 0,
                ia = 0,
                ja = 0,
                ka = 0,
                la = 0,
                ma = 0,
                na = 0,
                oa = 0;
            j = i;
            i = i + 272 | 0;
            u = j + 195 | 0;
            A = j + 130 | 0;
            y = j + 65 | 0;
            w = j;
            s = c[b + 136 >> 2] | 0;
            r = c[b + 200 >> 2] | 0;
            L = c[r + (h << 2) + 13168 >> 2] | 0;
            M = c[r + (h << 2) + 13180 >> 2] | 0;
            l = 1 << g;
            fa = l << L;
            Z = c[r + 13072 >> 2] | 0;
            ha = l << M;
            ba = c[r + 13164 >> 2] | 0;
            N = e >> Z & ba;
            aa = f >> Z & ba;
            _ = ba + 2 | 0;
            Y = ($(aa, _) | 0) + N | 0;
            T = c[b + 204 >> 2] | 0;
            U = c[T + 1684 >> 2] | 0;
            Y = c[U + (Y << 2) >> 2] | 0;
            n = c[b + 160 >> 2] | 0;
            k = c[n + (h << 2) + 32 >> 2] | 0;
            n = c[n + (h << 2) >> 2] | 0;
            m = ($(k, f >> M) | 0) + (e >> L) | 0;
            o = n + m | 0;
            K = c[r + 13156 >> 2] | 0;
            p = (h | 0) == 0;
            q = c[(p ? s + 288 | 0 : s + 292 | 0) >> 2] | 0;
            v = u + 1 | 0;
            z = y + 1 | 0;
            x = A + 1 | 0;
            t = w + 1 | 0;
            if (!(c[s + 31288 >> 2] | 0)) ja = 0;
            else ja = (Y | 0) > (c[U + (N + -1 + ($(ba & aa + (ha >> Z), _) | 0) << 2) >> 2] | 0);
            ga = ja & 1;
            R = c[s + 31292 >> 2] | 0;
            S = c[s + 31300 >> 2] | 0;
            P = c[s + 31296 >> 2] | 0;
            if (!(c[s + 31304 >> 2] | 0)) U = 0;
            else U = (Y | 0) > (c[U + (($(_, aa + -1 | 0) | 0) + (ba & N + (fa >> Z)) << 2) >> 2] | 0);
            N = U & 1;
            aa = (ha << 1) + f | 0;
            ba = r + 13124 | 0;
            ea = c[ba >> 2] | 0;
            Z = ha + f | 0;
            aa = ((aa | 0) > (ea | 0) ? ea : aa) - Z >> M;
            ea = (fa << 1) + e | 0;
            Y = r + 13120 | 0;
            ca = c[Y >> 2] | 0;
            _ = fa + e | 0;
            ea = ((ea | 0) > (ca | 0) ? ca : ea) - _ >> L;
            ca = T + 20 | 0;
            if ((a[ca >> 0] | 0) == 1) {
                T = c[r + 13084 >> 2] | 0;
                ia = ha >> T;
                fa = fa >> T;
                ka = (1 << T) + -1 | 0;
                ha = ka & f;
                fa = ((fa | 0) == 0 & 1) + fa | 0;
                ka = (ka & e | 0) != 0;
                if (!(ka | ja ^ 1)) {
                    ma = e + -1 >> T;
                    la = Z >> T;
                    na = (c[r + 13160 >> 2] | 0) - la | 0;
                    na = (ia | 0) > (na | 0) ? na : ia;
                    if ((na | 0) > 0) {
                        oa = c[(c[b + 3508 >> 2] | 0) + 16 >> 2] | 0;
                        ga = 0;
                        ja = 0;
                        do {
                            ga = (a[oa + ((($(ja + la | 0, K) | 0) + ma | 0) * 12 | 0) + 10 >> 0] | 0) == 0 | ga;
                            ja = ja + 2 | 0
                        } while ((ja | 0) < (na | 0))
                    } else ga = 0
                }
                if (!((R | 0) != 1 | ka)) {
                    ja = e + -1 >> T;
                    ka = f >> T;
                    ma = (c[r + 13160 >> 2] | 0) - ka | 0;
                    ma = (ia | 0) > (ma | 0) ? ma : ia;
                    if ((ma | 0) > 0) {
                        ia = c[(c[b + 3508 >> 2] | 0) + 16 >> 2] | 0;
                        R = 0;
                        la = 0;
                        do {
                            R = (a[ia + ((($(la + ka | 0, K) | 0) + ja | 0) * 12 | 0) + 10 >> 0] | 0) == 0 | R;
                            la = la + 2 | 0
                        } while ((la | 0) < (ma | 0))
                    } else R = 0
                }
                if ((S | 0) == 1) {
                    S = ($(f + -1 >> T, K) | 0) + (e + -1 >> T) | 0;
                    S = (a[(c[(c[b + 3508 >> 2] | 0) + 16 >> 2] | 0) + (S * 12 | 0) + 10 >> 0] | 0) == 0 & 1
                }
                ha = (ha | 0) != 0;
                if (!((P | 0) != 1 | ha)) {
                    P = e >> T;
                    ia = K - P | 0;
                    ia = (fa | 0) > (ia | 0) ? ia : fa;
                    if ((ia | 0) > 0) {
                        ja = ($(f + -1 >> T, K) | 0) + P | 0;
                        la = c[(c[b + 3508 >> 2] | 0) + 16 >> 2] | 0;
                        P = 0;
                        ka = 0;
                        do {
                            P = (a[la + ((ja + ka | 0) * 12 | 0) + 10 >> 0] | 0) == 0 | P;
                            ka = ka + 2 | 0
                        } while ((ka | 0) < (ia | 0))
                    } else P = 0
                }
                if (!(ha | U ^ 1)) {
                    N = _ >> T;
                    U = K - N | 0;
                    U = (fa | 0) > (U | 0) ? U : fa;
                    if ((U | 0) > 0) {
                        ha = ($(f + -1 >> T, K) | 0) + N | 0;
                        fa = c[(c[b + 3508 >> 2] | 0) + 16 >> 2] | 0;
                        N = 0;
                        T = 0;
                        do {
                            N = (a[fa + ((ha + T | 0) * 12 | 0) + 10 >> 0] | 0) == 0 | N;
                            T = T + 2 | 0
                        } while ((T | 0) < (U | 0))
                    } else N = 0
                }
                U = v + 0 | 0;
                T = U + 64 | 0;
                do {
                    a[U >> 0] = 128;
                    U = U + 1 | 0
                } while ((U | 0) < (T | 0));
                U = y + 0 | 0;
                T = U + 65 | 0;
                do {
                    a[U >> 0] = 128;
                    U = U + 1 | 0
                } while ((U | 0) < (T | 0));
                fa = N
            } else fa = N;
            T = (S | 0) != 0;
            if (T) {
                oa = a[n + (m + ~k) >> 0] | 0;
                a[u >> 0] = oa;
                a[y >> 0] = oa
            }
            U = (P | 0) != 0;
            if (U) mf(z | 0, n + (m - k) | 0, l | 0) | 0;
            N = (fa | 0) != 0;
            if (N ? (da = l + 1 | 0, mf(y + da | 0, n + (l - k + m) | 0, l | 0) | 0, W = $(d[n + (l + -1 - k + m + ea) >> 0] | 0, 16843009) | 0, V = l - ea | 0, (V | 0) > 0) : 0) {
                ea = ea + da | 0;
                da = 0;
                do {
                    oa = y + (ea + da) | 0;
                    a[oa >> 0] = W;
                    a[oa + 1 >> 0] = W >> 8;
                    a[oa + 2 >> 0] = W >> 16;
                    a[oa + 3 >> 0] = W >> 24;
                    da = da + 4 | 0
                } while ((da | 0) < (V | 0))
            }
            V = (R | 0) != 0;
            if (V & (l | 0) > 0) {
                da = m + -1 | 0;
                W = 0;
                do {
                    oa = W;
                    W = W + 1 | 0;
                    a[u + W >> 0] = a[n + (da + ($(oa, k) | 0)) >> 0] | 0
                } while ((W | 0) != (l | 0))
            }
            W = (ga | 0) != 0;
            if (W) {
                ea = aa + l | 0;
                da = m + -1 | 0;
                if ((aa | 0) > 0) {
                    ha = l;
                    do {
                        oa = ha;
                        ha = ha + 1 | 0;
                        a[u + ha >> 0] = a[n + (da + ($(oa, k) | 0)) >> 0] | 0
                    } while ((ha | 0) < (ea | 0))
                }
                ia = $(d[n + (da + ($(ea + -1 | 0, k) | 0)) >> 0] | 0, 16843009) | 0;
                ha = l - aa | 0;
                if ((ha | 0) > 0) {
                    ea = l + 1 + aa | 0;
                    da = 0;
                    do {
                        oa = u + (ea + da) | 0;
                        a[oa >> 0] = ia;
                        a[oa + 1 >> 0] = ia >> 8;
                        a[oa + 2 >> 0] = ia >> 16;
                        a[oa + 3 >> 0] = ia >> 24;
                        da = da + 4 | 0
                    } while ((da | 0) < (ha | 0))
                }
            }
            do
                if ((a[ca >> 0] | 0) == 1 ? (oa = ga | R, Q = (oa | 0) != 0, oa = oa | S, X = (oa | 0) == 0, (P | fa | oa | 0) != 0) : 0) {
                    da = l << 1;
                    ca = c[Y >> 2] | 0;
                    if (((da << L) + e | 0) < (ca | 0)) Y = da;
                    else Y = ca - e >> L;
                    ba = c[ba >> 2] | 0;
                    if (((da << M) + f | 0) >= (ba | 0)) da = ba - f >> M;
                    aa = (W ? aa : 0) + l | 0;
                    if (!N)
                        if ((_ | 0) < (ca | 0)) Y = l;
                        else Y = ca - e >> L;
                    if (!W)
                        if ((Z | 0) < (ba | 0)) Z = l;
                        else Z = ba - f >> M;
                    else Z = da;
                    do
                        if (X) {
                            do
                                if ((Y | 0) > 0) {
                                    ba = c[r + 13084 >> 2] | 0;
                                    aa = $((-1 << M) + f >> ba, K) | 0;
                                    _ = c[(c[b + 3508 >> 2] | 0) + 16 >> 2] | 0;
                                    X = 0;
                                    while (1) {
                                        ca = X + 1 | 0;
                                        if (!(a[_ + ((aa + ((X << L) + e >> ba) | 0) * 12 | 0) + 10 >> 0] | 0)) break;
                                        if ((ca | 0) < (Y | 0)) X = ca;
                                        else {
                                            X = ca;
                                            break
                                        }
                                    }
                                    if ((X | 0) > 0)
                                        if ((e | 0) > 0) {
                                            if ((X | 0) <= -1) break;
                                            aa = (-1 << M) + f | 0;
                                            _ = c[b + 3508 >> 2] | 0;
                                            do {
                                                ba = X;
                                                X = X + -1 | 0;
                                                oa = c[r + 13084 >> 2] | 0;
                                                oa = ($(aa >> oa, K) | 0) + ((X << L) + e >> oa) | 0;
                                                if (a[(c[_ + 16 >> 2] | 0) + (oa * 12 | 0) + 10 >> 0] | 0) a[y + ba >> 0] = a[y + (ba + 1) >> 0] | 0
                                            } while ((ba | 0) > 0)
                                        } else {
                                            aa = (-1 << M) + f | 0;
                                            _ = c[b + 3508 >> 2] | 0;
                                            do {
                                                ba = X;
                                                X = X + -1 | 0;
                                                oa = c[r + 13084 >> 2] | 0;
                                                oa = ($(aa >> oa, K) | 0) + ((X << L) + e >> oa) | 0;
                                                if (a[(c[_ + 16 >> 2] | 0) + (oa * 12 | 0) + 10 >> 0] | 0) a[y + ba >> 0] = a[y + (ba + 1) >> 0] | 0
                                            } while ((X | 0) > 0);
                                            a[y >> 0] = a[z >> 0] | 0;
                                            break
                                        }
                                }
                            while (0);
                            X = a[y >> 0] | 0;
                            a[u >> 0] = X
                        } else {
                            ca = (-1 << L) + e | 0;
                            ea = b + 3508 | 0;
                            while (1) {
                                oa = aa;
                                aa = aa + -1 | 0;
                                X = c[r + 13084 >> 2] | 0;
                                if ((oa | 0) <= 0) {
                                    J = 59;
                                    break
                                }
                                _ = (aa << M) + f | 0;
                                oa = ($(_ >> X, K) | 0) + (ca >> X) | 0;
                                da = c[ea >> 2] | 0;
                                ba = c[da + 16 >> 2] | 0;
                                if (!(a[ba + (oa * 12 | 0) + 10 >> 0] | 0)) {
                                    ea = _;
                                    break
                                }
                            }
                            if ((J | 0) == 59) {
                                ba = c[ea >> 2] | 0;
                                da = ba;
                                ba = c[ba + 16 >> 2] | 0;
                                ea = (aa << M) + f | 0
                            }
                            _ = r + 13084 | 0;
                            aa = da + 16 | 0;
                            if (!(a[ba + ((($(ea >> X, K) | 0) + (ca >> X) | 0) * 12 | 0) + 10 >> 0] | 0)) {
                                X = a[y >> 0] | 0;
                                break
                            }
                            if ((Y | 0) > 0) {
                                ca = $((-1 << M) + f >> X, K) | 0;
                                da = 0;
                                while (1) {
                                    ea = da + 1 | 0;
                                    if (!(a[ba + ((ca + ((da << L) + e >> X) | 0) * 12 | 0) + 10 >> 0] | 0)) break;
                                    if ((ea | 0) < (Y | 0)) da = ea;
                                    else {
                                        da = ea;
                                        break
                                    }
                                }
                                if ((da | 0) > -1) J = 68
                            } else {
                                da = 0;
                                J = 68
                            }
                            a: do
                                if ((J | 0) == 68) {
                                    ca = (-1 << M) + f | 0;
                                    while (1) {
                                        ea = da + -1 | 0;
                                        if (a[ba + ((($(ca >> X, K) | 0) + ((ea << L) + e >> X) | 0) * 12 | 0) + 10 >> 0] | 0) a[y + da >> 0] = a[y + (da + 1) >> 0] | 0;
                                        if ((da | 0) <= 0) break a;
                                        X = c[_ >> 2] | 0;
                                        ba = c[aa >> 2] | 0;
                                        da = ea
                                    }
                                }
                            while (0);
                            X = a[y >> 0] | 0;
                            a[u >> 0] = X
                        }
                    while (0);
                    a[u >> 0] = X;
                    if (Q & (Z | 0) > 0) {
                        aa = $(X & 255, 16843009) | 0;
                        Q = (-1 << L) + e | 0;
                        X = c[b + 3508 >> 2] | 0;
                        _ = 0;
                        do {
                            oa = c[r + 13084 >> 2] | 0;
                            oa = ($((_ << M) + f >> oa, K) | 0) + (Q >> oa) | 0;
                            if (!(a[(c[X + 16 >> 2] | 0) + (oa * 12 | 0) + 10 >> 0] | 0)) aa = $(d[u + ((_ | 3) + 1) >> 0] | 0, 16843009) | 0;
                            else {
                                oa = u + (_ | 1) | 0;
                                a[oa >> 0] = aa;
                                a[oa + 1 >> 0] = aa >> 8;
                                a[oa + 2 >> 0] = aa >> 16;
                                a[oa + 3 >> 0] = aa >> 24
                            }
                            _ = _ + 4 | 0
                        } while ((_ | 0) < (Z | 0))
                    }
                    if (!V ? (O = $(d[u >> 0] | 0, 16843009) | 0, (l | 0) > 0) : 0) {
                        Q = 0;
                        do {
                            oa = u + (Q | 1) | 0;
                            a[oa >> 0] = O;
                            a[oa + 1 >> 0] = O >> 8;
                            a[oa + 2 >> 0] = O >> 16;
                            a[oa + 3 >> 0] = O >> 24;
                            Q = Q + 4 | 0
                        } while ((Q | 0) < (l | 0))
                    }
                    do
                        if (!W) {
                            O = $(d[u + l >> 0] | 0, 16843009) | 0;
                            if ((l | 0) <= 0) break;
                            Q = l + 1 | 0;
                            X = 0;
                            do {
                                oa = u + (Q + X) | 0;
                                a[oa >> 0] = O;
                                a[oa + 1 >> 0] = O >> 8;
                                a[oa + 2 >> 0] = O >> 16;
                                a[oa + 3 >> 0] = O >> 24;
                                X = X + 4 | 0
                            } while ((X | 0) < (l | 0))
                        }
                    while (0);
                    Q = (e | 0) == 0;
                    O = (f | 0) == 0;
                    _ = (Z | 0) > 0;
                    b: do
                        if (Q | O) {
                            if (Q) {
                                if (_) Q = 0;
                                else break;
                                while (1) {
                                    oa = u + (Q | 1) | 0;
                                    a[oa >> 0] = 0;
                                    a[oa + 1 >> 0] = 0;
                                    a[oa + 2 >> 0] = 0;
                                    a[oa + 3 >> 0] = 0;
                                    Q = Q + 4 | 0;
                                    if ((Q | 0) >= (Z | 0)) break b
                                }
                            }
                            if (!_) break;
                            _ = $(d[u + Z >> 0] | 0, 16843009) | 0;
                            X = (-1 << L) + e | 0;
                            Q = c[b + 3508 >> 2] | 0;
                            Z = Z + -1 | 0;
                            do {
                                oa = c[r + 13084 >> 2] | 0;
                                oa = ($((Z + -3 << M) + f >> oa, K) | 0) + (X >> oa) | 0;
                                aa = u + (Z + -2) | 0;
                                if (!(a[(c[Q + 16 >> 2] | 0) + (oa * 12 | 0) + 10 >> 0] | 0)) _ = $(d[aa >> 0] | 0, 16843009) | 0;
                                else {
                                    a[aa >> 0] = _;
                                    a[aa + 1 >> 0] = _ >> 8;
                                    a[aa + 2 >> 0] = _ >> 16;
                                    a[aa + 3 >> 0] = _ >> 24
                                }
                                Z = Z + -4 | 0
                            } while ((Z | 0) > -1)
                        } else {
                            Q = (-1 << L) + e | 0;
                            X = r + 13084 | 0;
                            ba = c[X >> 2] | 0;
                            ca = Q >> ba;
                            if (_) {
                                aa = $(d[u + Z >> 0] | 0, 16843009) | 0;
                                _ = c[b + 3508 >> 2] | 0;
                                Z = Z + -1 | 0;
                                do {
                                    oa = ($((Z + -3 << M) + f >> ba, K) | 0) + ca | 0;
                                    ca = u + (Z + -2) | 0;
                                    if (!(a[(c[_ + 16 >> 2] | 0) + (oa * 12 | 0) + 10 >> 0] | 0)) aa = $(d[ca >> 0] | 0, 16843009) | 0;
                                    else {
                                        a[ca >> 0] = aa;
                                        a[ca + 1 >> 0] = aa >> 8;
                                        a[ca + 2 >> 0] = aa >> 16;
                                        a[ca + 3 >> 0] = aa >> 24;
                                        ba = c[X >> 2] | 0
                                    }
                                    Z = Z + -4 | 0;
                                    ca = Q >> ba
                                } while ((Z | 0) > -1)
                            } else _ = c[b + 3508 >> 2] | 0;
                            oa = ($((-1 << M) + f >> ba, K) | 0) + ca | 0;
                            if (!(a[(c[_ + 16 >> 2] | 0) + (oa * 12 | 0) + 10 >> 0] | 0)) break;
                            a[u >> 0] = a[v >> 0] | 0
                        }
                    while (0);
                    Q = a[u >> 0] | 0;
                    a[y >> 0] = Q;
                    if (!((Y | 0) > 0 & (O ^ 1))) break;
                    O = $(Q & 255, 16843009) | 0;
                    M = (-1 << M) + f | 0;
                    b = c[b + 3508 >> 2] | 0;
                    f = 0;
                    do {
                        oa = c[r + 13084 >> 2] | 0;
                        oa = ($(M >> oa, K) | 0) + ((f << L) + e >> oa) | 0;
                        if (!(a[(c[b + 16 >> 2] | 0) + (oa * 12 | 0) + 10 >> 0] | 0)) O = $(d[y + ((f | 3) + 1) >> 0] | 0, 16843009) | 0;
                        else {
                            oa = y + (f | 1) | 0;
                            a[oa >> 0] = O;
                            a[oa + 1 >> 0] = O >> 8;
                            a[oa + 2 >> 0] = O >> 16;
                            a[oa + 3 >> 0] = O >> 24
                        }
                        f = f + 4 | 0
                    } while ((f | 0) < (Y | 0))
                }
            while (0);
            c: do
                if (!W) {
                    if (V) {
                        J = $(d[u + l >> 0] | 0, 16843009) | 0;
                        if ((l | 0) <= 0) {
                            J = 148;
                            break
                        }
                        K = l + 1 | 0;
                        L = 0;
                        while (1) {
                            oa = u + (K + L) | 0;
                            a[oa >> 0] = J;
                            a[oa + 1 >> 0] = J >> 8;
                            a[oa + 2 >> 0] = J >> 16;
                            a[oa + 3 >> 0] = J >> 24;
                            L = L + 4 | 0;
                            if ((L | 0) >= (l | 0)) {
                                J = 148;
                                break c
                            }
                        }
                    }
                    if (T) {
                        J = $(d[u >> 0] | 0, 16843009) | 0;
                        K = l << 1;
                        if ((l | 0) > 0) I = 0;
                        else {
                            J = 151;
                            break
                        }
                        while (1) {
                            oa = u + (I | 1) | 0;
                            a[oa >> 0] = J;
                            a[oa + 1 >> 0] = J >> 8;
                            a[oa + 2 >> 0] = J >> 16;
                            a[oa + 3 >> 0] = J >> 24;
                            I = I + 4 | 0;
                            if ((I | 0) >= (K | 0)) {
                                J = 151;
                                break c
                            }
                        }
                    }
                    if (U) {
                        J = a[z >> 0] | 0;
                        a[u >> 0] = J;
                        J = $(J & 255, 16843009) | 0;
                        I = l << 1;
                        if ((l | 0) > 0) K = 0;
                        else {
                            J = 153;
                            break
                        }
                        while (1) {
                            oa = u + (K | 1) | 0;
                            a[oa >> 0] = J;
                            a[oa + 1 >> 0] = J >> 8;
                            a[oa + 2 >> 0] = J >> 16;
                            a[oa + 3 >> 0] = J >> 24;
                            K = K + 4 | 0;
                            if ((K | 0) >= (I | 0)) {
                                J = 153;
                                break c
                            }
                        }
                    }
                    if (!N) {
                        a[u >> 0] = -128;
                        J = l << 1;
                        L = (l | 0) > 0;
                        if (L) K = 0;
                        else {
                            J = 148;
                            break
                        }
                        do {
                            oa = y + (K | 1) | 0;
                            a[oa >> 0] = -2139062144;
                            a[oa + 1 >> 0] = -2139062144 >> 8;
                            a[oa + 2 >> 0] = -2139062144 >> 16;
                            a[oa + 3 >> 0] = -2139062144 >> 24;
                            K = K + 4 | 0
                        } while ((K | 0) < (J | 0));
                        if (L) K = 0;
                        else {
                            J = 148;
                            break
                        }
                        while (1) {
                            oa = u + (K | 1) | 0;
                            a[oa >> 0] = -2139062144;
                            a[oa + 1 >> 0] = -2139062144 >> 8;
                            a[oa + 2 >> 0] = -2139062144 >> 16;
                            a[oa + 3 >> 0] = -2139062144 >> 24;
                            K = K + 4 | 0;
                            if ((K | 0) >= (J | 0)) {
                                J = 148;
                                break c
                            }
                        }
                    }
                    I = y + (l + 1) | 0;
                    L = a[I >> 0] | 0;
                    K = $(L & 255, 16843009) | 0;
                    H = (l | 0) > 0;
                    if (H) J = 0;
                    else {
                        a[u >> 0] = L;
                        break
                    }
                    do {
                        oa = y + (J | 1) | 0;
                        a[oa >> 0] = K;
                        a[oa + 1 >> 0] = K >> 8;
                        a[oa + 2 >> 0] = K >> 16;
                        a[oa + 3 >> 0] = K >> 24;
                        J = J + 4 | 0
                    } while ((J | 0) < (l | 0));
                    I = a[I >> 0] | 0;
                    a[u >> 0] = I;
                    I = $(I & 255, 16843009) | 0;
                    J = l << 1;
                    if (H) {
                        H = 0;
                        do {
                            oa = u + (H | 1) | 0;
                            a[oa >> 0] = I;
                            a[oa + 1 >> 0] = I >> 8;
                            a[oa + 2 >> 0] = I >> 16;
                            a[oa + 3 >> 0] = I >> 24;
                            H = H + 4 | 0
                        } while ((H | 0) < (J | 0));
                        J = 156
                    } else J = 156
                } else J = 148;
            while (0);
            if ((J | 0) == 148)
                if ((R | 0) == 0 ? (I = $(d[u + (l + 1) >> 0] | 0, 16843009) | 0, (l | 0) > 0) : 0) {
                    J = 0;
                    do {
                        oa = u + (J | 1) | 0;
                        a[oa >> 0] = I;
                        a[oa + 1 >> 0] = I >> 8;
                        a[oa + 2 >> 0] = I >> 16;
                        a[oa + 3 >> 0] = I >> 24;
                        J = J + 4 | 0
                    } while ((J | 0) < (l | 0));
                    J = 151
                } else J = 151;
            if ((J | 0) == 151)
                if (!S) {
                    a[u >> 0] = a[v >> 0] | 0;
                    J = 153
                } else J = 153;
            if ((J | 0) == 153)
                if ((P | 0) == 0 ? (H = $(d[u >> 0] | 0, 16843009) | 0, (l | 0) > 0) : 0) {
                    I = 0;
                    do {
                        oa = y + (I | 1) | 0;
                        a[oa >> 0] = H;
                        a[oa + 1 >> 0] = H >> 8;
                        a[oa + 2 >> 0] = H >> 16;
                        a[oa + 3 >> 0] = H >> 24;
                        I = I + 4 | 0
                    } while ((I | 0) < (l | 0));
                    J = 156
                } else J = 156;
            if (((J | 0) == 156 ? !N : 0) ? (G = $(d[y + l >> 0] | 0, 16843009) | 0, (l | 0) > 0) : 0) {
                I = l + 1 | 0;
                H = 0;
                do {
                    oa = y + (I + H) | 0;
                    a[oa >> 0] = G;
                    a[oa + 1 >> 0] = G >> 8;
                    a[oa + 2 >> 0] = G >> 16;
                    a[oa + 3 >> 0] = G >> 24;
                    H = H + 4 | 0
                } while ((H | 0) < (l | 0))
            }
            G = a[u >> 0] | 0;
            a[y >> 0] = G;
            d: do
                if (!(c[r + 13112 >> 2] | 0)) {
                    if (p) {
                        if ((q | 0) == 1 | (l | 0) == 4) {
                            t = z;
                            break
                        }
                    } else if (((q | 0) == 1 ? 1 : (c[r + 4 >> 2] | 0) != 3) | (l | 0) == 4) {
                        t = z;
                        break
                    }
                    oa = q + -26 | 0;
                    oa = (oa | 0) > -1 ? oa : 26 - q | 0;
                    na = q + -10 | 0;
                    na = (na | 0) > -1 ? na : 10 - q | 0;
                    if ((((oa | 0) > (na | 0) ? na : oa) | 0) > (c[1664 + (g + -3 << 2) >> 2] | 0)) {
                        if ((p & (a[r + 13061 >> 0] | 0) != 0 & (g | 0) == 5 ? (E = G & 255, F = a[y + 64 >> 0] | 0, D = F & 255, oa = D + E - (d[y + 32 >> 0] << 1) | 0, (((oa | 0) > -1 ? oa : 0 - oa | 0) | 0) < 8) : 0) ? (B = u + 64 | 0, C = a[B >> 0] | 0, oa = (C & 255) + E - (d[u + 32 >> 0] << 1) | 0, (((oa | 0) > -1 ? oa : 0 - oa | 0) | 0) < 8) : 0) {
                            a[w >> 0] = G;
                            a[w + 64 >> 0] = F;
                            x = 0;
                            do {
                                oa = x;
                                x = x + 1 | 0;
                                a[w + x >> 0] = (($(E, 63 - oa | 0) | 0) + 32 + ($(D, x) | 0) | 0) >>> 6
                            } while ((x | 0) != 63);
                            x = 0;
                            while (1) {
                                w = x + 1 | 0;
                                a[u + w >> 0] = (($(G & 255, 63 - x | 0) | 0) + 32 + ($(C & 255, w) | 0) | 0) >>> 6;
                                if ((w | 0) == 63) break d;
                                G = a[u >> 0] | 0;
                                C = a[B >> 0] | 0;
                                x = w
                            }
                        }
                        B = l << 1;
                        F = a[u + B >> 0] | 0;
                        a[A + B >> 0] = F;
                        C = a[y + B >> 0] | 0;
                        a[w + B >> 0] = C;
                        B = B + -2 | 0;
                        D = (B | 0) > -1;
                        if (D) {
                            E = B;
                            while (1) {
                                oa = E + 1 | 0;
                                na = F;
                                F = a[u + oa >> 0] | 0;
                                a[A + oa >> 0] = ((na & 255) + 2 + ((F & 255) << 1) + (d[u + E >> 0] | 0) | 0) >>> 2;
                                if ((E | 0) <= 0) break;
                                else E = E + -1 | 0
                            }
                        }
                        oa = ((d[v >> 0] | 0) + 2 + ((G & 255) << 1) + (d[z >> 0] | 0) | 0) >>> 2 & 255;
                        a[A >> 0] = oa;
                        a[w >> 0] = oa;
                        if (D)
                            while (1) {
                                oa = B + 1 | 0;
                                na = C;
                                C = a[y + oa >> 0] | 0;
                                a[w + oa >> 0] = ((na & 255) + 2 + ((C & 255) << 1) + (d[y + B >> 0] | 0) | 0) >>> 2;
                                if ((B | 0) <= 0) {
                                    v = x;
                                    break
                                } else B = B + -1 | 0
                            } else v = x
                    } else t = z
                } else t = z;
            while (0);
            if (!q) {
                nc(o, t, v, k, g);
                i = j;
                return
            } else if ((q | 0) == 1) {
                if ((l | 0) > 0) {
                    q = l;
                    h = 0;
                    do {
                        q = (d[v + h >> 0] | 0) + q + (d[t + h >> 0] | 0) | 0;
                        h = h + 1 | 0
                    } while ((h | 0) != (l | 0));
                    q = q >> g + 1;
                    h = $(q, 16843009) | 0;
                    r = 0;
                    do {
                        s = ($(r, k) | 0) + m | 0;
                        g = 0;
                        do {
                            oa = n + (s + g) | 0;
                            a[oa >> 0] = h;
                            a[oa + 1 >> 0] = h >> 8;
                            a[oa + 2 >> 0] = h >> 16;
                            a[oa + 3 >> 0] = h >> 24;
                            g = g + 4 | 0
                        } while ((g | 0) < (l | 0));
                        r = r + 1 | 0
                    } while ((r | 0) != (l | 0))
                } else q = l >> g + 1;
                if (!(p & (l | 0) < 32)) {
                    i = j;
                    return
                }
                a[o >> 0] = ((q << 1) + 2 + (d[v >> 0] | 0) + (d[t >> 0] | 0) | 0) >>> 2;
                if ((l | 0) <= 1) {
                    i = j;
                    return
                }
                o = (q * 3 | 0) + 2 | 0;
                p = 1;
                do {
                    a[n + (p + m) >> 0] = ((d[t + p >> 0] | 0) + o | 0) >>> 2;
                    p = p + 1 | 0
                } while ((p | 0) != (l | 0));
                p = 1;
                do {
                    a[n + (($(p, k) | 0) + m) >> 0] = ((d[v + p >> 0] | 0) + o | 0) >>> 2;
                    p = p + 1 | 0
                } while ((p | 0) != (l | 0));
                i = j;
                return
            } else {
                if (!(c[r + 13104 >> 2] | 0)) m = 0;
                else m = (a[s + 31256 >> 0] | 0) != 0;
                oc(o, t, v, k, h, q, l, m & 1);
                i = j;
                return
            }
        }

        function nc(b, c, e, f, g) {
            b = b | 0;
            c = c | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            var h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0;
            m = i;
            j = 1 << g;
            if ((j | 0) <= 0) {
                i = m;
                return
            }
            l = j + -1 | 0;
            h = c + j | 0;
            k = e + j | 0;
            g = g + 1 | 0;
            n = 0;
            do {
                o = e + n | 0;
                p = l - n | 0;
                q = $(n, f) | 0;
                n = n + 1 | 0;
                r = 0;
                do {
                    v = $(d[o >> 0] | 0, l - r | 0) | 0;
                    s = r;
                    r = r + 1 | 0;
                    u = $(d[h >> 0] | 0, r) | 0;
                    t = $(d[c + s >> 0] | 0, p) | 0;
                    a[b + (s + q) >> 0] = v + j + u + t + ($(d[k >> 0] | 0, n) | 0) >> g
                } while ((r | 0) != (j | 0))
            } while ((n | 0) != (j | 0));
            i = m;
            return
        }

        function oc(c, e, f, g, h, j, k, l) {
            c = c | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            var m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0;
            m = i;
            i = i + 112 | 0;
            o = m;
            n = a[1680 + (j + -2) >> 0] | 0;
            p = o + k | 0;
            q = ($(n, k) | 0) >> 5;
            if ((j | 0) > 17) {
                s = e + -1 | 0;
                r = j + -11 | 0;
                if (r >>> 0 < 15 & (q | 0) < -1) {
                    if ((k | 0) >= 0) {
                        s = 0;
                        do {
                            u = e + (s + -1) | 0;
                            u = d[u >> 0] | d[u + 1 >> 0] << 8 | d[u + 2 >> 0] << 16 | d[u + 3 >> 0] << 24;
                            v = o + (s + k) | 0;
                            a[v >> 0] = u;
                            a[v + 1 >> 0] = u >> 8;
                            a[v + 2 >> 0] = u >> 16;
                            a[v + 3 >> 0] = u >> 24;
                            s = s + 4 | 0
                        } while ((s | 0) <= (k | 0))
                    }
                    if ((q | 0) < 0) {
                        r = b[1720 + (r << 1) >> 1] | 0;
                        do {
                            a[o + (q + k) >> 0] = a[f + ((($(r, q) | 0) + 128 >> 8) + -1) >> 0] | 0;
                            q = q + 1 | 0
                        } while ((q | 0) != 0)
                    }
                } else p = s;
                o = (k | 0) > 0;
                if (o) {
                    q = 0;
                    do {
                        u = q;
                        q = q + 1 | 0;
                        s = $(q, n) | 0;
                        r = s >> 5;
                        s = s & 31;
                        if (!s) {
                            r = r + 1 | 0;
                            s = $(u, g) | 0;
                            t = 0;
                            do {
                                u = p + (r + t) | 0;
                                u = d[u >> 0] | d[u + 1 >> 0] << 8 | d[u + 2 >> 0] << 16 | d[u + 3 >> 0] << 24;
                                v = c + (t + s) | 0;
                                a[v >> 0] = u;
                                a[v + 1 >> 0] = u >> 8;
                                a[v + 2 >> 0] = u >> 16;
                                a[v + 3 >> 0] = u >> 24;
                                t = t + 4 | 0
                            } while ((t | 0) < (k | 0))
                        } else {
                            t = 32 - s | 0;
                            v = $(u, g) | 0;
                            u = 0;
                            do {
                                w = u + r | 0;
                                x = $(d[p + (w + 1) >> 0] | 0, t) | 0;
                                a[c + (u + v) >> 0] = (x + 16 + ($(d[p + (w + 2) >> 0] | 0, s) | 0) | 0) >>> 5;
                                w = u | 1;
                                x = w + r | 0;
                                y = $(d[p + (x + 1) >> 0] | 0, t) | 0;
                                a[c + (w + v) >> 0] = (y + 16 + ($(d[p + (x + 2) >> 0] | 0, s) | 0) | 0) >>> 5;
                                w = u | 2;
                                x = w + r | 0;
                                y = $(d[p + (x + 1) >> 0] | 0, t) | 0;
                                a[c + (w + v) >> 0] = (y + 16 + ($(d[p + (x + 2) >> 0] | 0, s) | 0) | 0) >>> 5;
                                w = u | 3;
                                x = w + r | 0;
                                y = $(d[p + (x + 1) >> 0] | 0, t) | 0;
                                a[c + (w + v) >> 0] = (y + 16 + ($(d[p + (x + 2) >> 0] | 0, s) | 0) | 0) >>> 5;
                                u = u + 4 | 0
                            } while ((u | 0) < (k | 0))
                        }
                    } while ((q | 0) != (k | 0))
                }
                if (!((j | 0) == 26 & (h | 0) == 0 & (k | 0) < 32 & (l | 0) == 0 & o)) {
                    i = m;
                    return
                }
                j = f + -1 | 0;
                n = 0;
                do {
                    h = ((d[f + n >> 0] | 0) - (d[j >> 0] | 0) >> 1) + (d[e >> 0] | 0) | 0;
                    if (h >>> 0 > 255) h = 0 - h >> 31;
                    a[c + ($(n, g) | 0) >> 0] = h;
                    n = n + 1 | 0
                } while ((n | 0) != (k | 0));
                i = m;
                return
            }
            s = f + -1 | 0;
            r = j + -11 | 0;
            if (r >>> 0 < 15 & (q | 0) < -1) {
                if ((k | 0) >= 0) {
                    s = 0;
                    do {
                        x = f + (s + -1) | 0;
                        x = d[x >> 0] | d[x + 1 >> 0] << 8 | d[x + 2 >> 0] << 16 | d[x + 3 >> 0] << 24;
                        y = o + (s + k) | 0;
                        a[y >> 0] = x;
                        a[y + 1 >> 0] = x >> 8;
                        a[y + 2 >> 0] = x >> 16;
                        a[y + 3 >> 0] = x >> 24;
                        s = s + 4 | 0
                    } while ((s | 0) <= (k | 0))
                }
                if ((q | 0) < 0) {
                    r = b[1720 + (r << 1) >> 1] | 0;
                    do {
                        a[o + (q + k) >> 0] = a[e + ((($(r, q) | 0) + 128 >> 8) + -1) >> 0] | 0;
                        q = q + 1 | 0
                    } while ((q | 0) != 0)
                }
            } else p = s;
            q = (k | 0) > 0;
            if (q) {
                o = 0;
                do {
                    r = o;
                    o = o + 1 | 0;
                    t = $(o, n) | 0;
                    u = t >> 5;
                    t = t & 31;
                    if (!t) {
                        s = u + 1 | 0;
                        t = 0;
                        do {
                            a[c + (($(t, g) | 0) + r) >> 0] = a[p + (s + t) >> 0] | 0;
                            t = t + 1 | 0
                        } while ((t | 0) != (k | 0))
                    } else {
                        s = 32 - t | 0;
                        v = 0;
                        do {
                            y = v + u | 0;
                            x = $(d[p + (y + 1) >> 0] | 0, s) | 0;
                            a[c + (($(v, g) | 0) + r) >> 0] = (x + 16 + ($(d[p + (y + 2) >> 0] | 0, t) | 0) | 0) >>> 5;
                            v = v + 1 | 0
                        } while ((v | 0) != (k | 0))
                    }
                } while ((o | 0) != (k | 0))
            }
            if (!((j | 0) == 10 & (h | 0) == 0 & (k | 0) < 32 & (l | 0) == 0 & q)) {
                i = m;
                return
            }
            g = e + -1 | 0;
            n = 0;
            do {
                j = ((d[e + n >> 0] | 0) - (d[g >> 0] | 0) >> 1) + (d[f >> 0] | 0) | 0;
                if (j >>> 0 > 255) j = 0 - j >> 31;
                a[c + n >> 0] = j;
                j = n | 1;
                h = ((d[e + j >> 0] | 0) - (d[g >> 0] | 0) >> 1) + (d[f >> 0] | 0) | 0;
                if (h >>> 0 > 255) h = 0 - h >> 31;
                a[c + j >> 0] = h;
                j = n | 2;
                h = ((d[e + j >> 0] | 0) - (d[g >> 0] | 0) >> 1) + (d[f >> 0] | 0) | 0;
                if (h >>> 0 > 255) h = 0 - h >> 31;
                a[c + j >> 0] = h;
                j = n | 3;
                h = ((d[e + j >> 0] | 0) - (d[g >> 0] | 0) >> 1) + (d[f >> 0] | 0) | 0;
                if (h >>> 0 > 255) h = 0 - h >> 31;
                a[c + j >> 0] = h;
                n = n + 4 | 0
            } while ((n | 0) < (k | 0));
            i = m;
            return
        }

        function pc(b, e, f) {
            b = b | 0;
            e = e | 0;
            f = f | 0;
            var g = 0,
                h = 0;
            g = i;
            h = c[e >> 2] | 0;
            if (!h) {
                i = g;
                return
            }
            if (!(c[h + 304 >> 2] | 0)) {
                i = g;
                return
            }
            h = e + 70 | 0;
            f = (d[h >> 0] | 0) & (f ^ 255) & 255;
            a[h >> 0] = f;
            if (f << 24 >> 24) {
                i = g;
                return
            }
            Qd(c[b + 4 >> 2] | 0, e + 4 | 0);
            ue(e + 56 | 0);
            c[e + 16 >> 2] = 0;
            ue(e + 64 | 0);
            ue(e + 60 | 0);
            c[e + 24 >> 2] = 0;
            c[e + 20 >> 2] = 0;
            c[e + 36 >> 2] = 0;
            i = g;
            return
        }

        function qc(a, b, d, e) {
            a = a | 0;
            b = b | 0;
            d = d | 0;
            e = e | 0;
            var f = 0,
                g = 0;
            g = c[a + 200 >> 2] | 0;
            f = c[g + 13080 >> 2] | 0;
            e = ($(e >> f, c[g + 13128 >> 2] | 0) | 0) + (d >> f) | 0;
            return c[(c[b + 24 >> 2] | 0) + (c[(c[(c[a + 204 >> 2] | 0) + 1668 >> 2] | 0) + (e << 2) >> 2] << 2) >> 2] | 0
        }

        function rc(a) {
            a = a | 0;
            var b = 0,
                c = 0;
            b = i;
            c = 0;
            do {
                pc(a, a + (c * 72 | 0) + 3512 | 0, 6);
                c = c + 1 | 0
            } while ((c | 0) != 32);
            i = b;
            return
        }

        function sc(a) {
            a = a | 0;
            var b = 0,
                c = 0;
            b = i;
            c = 0;
            do {
                pc(a, a + (c * 72 | 0) + 3512 | 0, -1);
                c = c + 1 | 0
            } while ((c | 0) != 32);
            i = b;
            return
        }

        function tc(d, e, f) {
            d = d | 0;
            e = e | 0;
            f = f | 0;
            var g = 0,
                h = 0,
                j = 0,
                k = 0;
            g = i;
            h = d + 7616 | 0;
            k = 0;
            do {
                if (((c[(c[d + (k * 72 | 0) + 3512 >> 2] | 0) + 304 >> 2] | 0) != 0 ? (b[d + (k * 72 | 0) + 3580 >> 1] | 0) == (b[h >> 1] | 0) : 0) ? (c[d + (k * 72 | 0) + 3544 >> 2] | 0) == (f | 0) : 0) {
                    e = -1094995529;
                    j = 8;
                    break
                }
                k = k + 1 | 0
            } while (k >>> 0 < 32);
            if ((j | 0) == 8) {
                i = g;
                return e | 0
            }
            j = uc(d) | 0;
            if (!j) {
                k = -12;
                i = g;
                return k | 0
            }
            c[e >> 2] = c[j >> 2];
            c[d + 3508 >> 2] = j;
            a[j + 70 >> 0] = (a[d + 2438 >> 0] | 0) == 0 ? 2 : 3;
            c[j + 32 >> 2] = f;
            b[j + 68 >> 1] = b[h >> 1] | 0;
            k = j + 40 | 0;
            j = (c[d + 200 >> 2] | 0) + 20 | 0;
            c[k + 0 >> 2] = c[j + 0 >> 2];
            c[k + 4 >> 2] = c[j + 4 >> 2];
            c[k + 8 >> 2] = c[j + 8 >> 2];
            c[k + 12 >> 2] = c[j + 12 >> 2];
            k = 0;
            i = g;
            return k | 0
        }

        function uc(a) {
            a = a | 0;
            var b = 0,
                d = 0,
                e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0;
            b = i;
            f = 0;
            while (1) {
                d = a + (f * 72 | 0) + 3512 | 0;
                j = f + 1 | 0;
                if (!(c[(c[d >> 2] | 0) + 304 >> 2] | 0)) break;
                if (j >>> 0 < 32) f = j;
                else {
                    a = 0;
                    e = 13;
                    break
                }
            }
            if ((e | 0) == 13) {
                i = b;
                return a | 0
            }
            if ((Pd(c[a + 4 >> 2] | 0, a + (f * 72 | 0) + 3516 | 0, 1) | 0) < 0) {
                j = 0;
                i = b;
                return j | 0
            }
            k = c[a + 200 >> 2] | 0;
            j = a + (f * 72 | 0) + 3540 | 0;
            c[j >> 2] = $(c[k + 13132 >> 2] | 0, c[k + 13128 >> 2] | 0) | 0;
            k = se((c[a + 7660 >> 2] | 0) * 392 | 0) | 0;
            e = a + (f * 72 | 0) + 3576 | 0;
            c[e >> 2] = k;
            if (((k | 0) != 0 ? (g = ye(c[a + 1428 >> 2] | 0) | 0, c[a + (f * 72 | 0) + 3568 >> 2] = g, (g | 0) != 0) : 0) ? (c[a + (f * 72 | 0) + 3528 >> 2] = c[g + 4 >> 2], h = ye(c[a + 1432 >> 2] | 0) | 0, c[a + (f * 72 | 0) + 3572 >> 2] = h, (h | 0) != 0) : 0) {
                h = c[h + 4 >> 2] | 0;
                f = a + (f * 72 | 0) + 3536 | 0;
                c[f >> 2] = h;
                g = c[j >> 2] | 0;
                a: do
                    if ((g | 0) > 0) {
                        j = 0;
                        while (1) {
                            c[h + (j << 2) >> 2] = c[(c[e >> 2] | 0) + 4 >> 2];
                            j = j + 1 | 0;
                            if ((j | 0) >= (g | 0)) break a;
                            h = c[f >> 2] | 0
                        }
                    }
                while (0);
                j = a + 7772 | 0;
                k = c[d >> 2] | 0;
                c[k + 244 >> 2] = (c[j >> 2] | 0) == 1 & 1;
                c[k + 240 >> 2] = ((c[j >> 2] | 0) + -1 | 0) >>> 0 < 2 & 1;
                k = d;
                i = b;
                return k | 0
            }
            pc(a, d, -1);
            k = 0;
            i = b;
            return k | 0
        }

        function vc(d, e, f) {
            d = d | 0;
            e = e | 0;
            f = f | 0;
            var g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0;
            g = i;
            k = d + 3034 | 0;
            j = d + 5816 | 0;
            h = d + 7618 | 0;
            f = (f | 0) == 0;
            n = d + 7616 | 0;
            m = d + 200 | 0;
            o = 0;
            while (1) {
                if ((a[k >> 0] | 0) == 1) {
                    q = 0;
                    do {
                        p = d + (q * 72 | 0) + 3512 | 0;
                        if (((a[d + (q * 72 | 0) + 3582 >> 0] & 8) == 0 ? (c[d + (q * 72 | 0) + 3544 >> 2] | 0) != (c[j >> 2] | 0) : 0) ? (b[d + (q * 72 | 0) + 3580 >> 1] | 0) == (b[h >> 1] | 0) : 0) pc(d, p, 1);
                        q = q + 1 | 0
                    } while ((q | 0) != 32);
                    p = 0;
                    r = 2147483647;
                    q = 0
                } else {
                    p = 0;
                    r = 2147483647;
                    q = 0
                }
                do {
                    if ((a[d + (p * 72 | 0) + 3582 >> 0] & 1) != 0 ? (b[d + (p * 72 | 0) + 3580 >> 1] | 0) == (b[h >> 1] | 0) : 0) {
                        s = c[d + (p * 72 | 0) + 3544 >> 2] | 0;
                        t = (s | 0) < (r | 0);
                        o = t ? p : o;
                        r = t ? s : r;
                        q = q + 1 | 0
                    }
                    p = p + 1 | 0
                } while ((p | 0) != 32);
                if (((f ? (b[h >> 1] | 0) == (b[n >> 1] | 0) : 0) ? (l = c[m >> 2] | 0, (l | 0) != 0) : 0) ? (q | 0) <= (c[l + (((c[l + 72 >> 2] | 0) + -1 | 0) * 12 | 0) + 80 >> 2] | 0) : 0) {
                    d = 0;
                    h = 23;
                    break
                }
                if (q) {
                    h = 17;
                    break
                }
                p = b[h >> 1] | 0;
                if (p << 16 >> 16 == (b[n >> 1] | 0)) {
                    d = 0;
                    h = 23;
                    break
                }
                b[h >> 1] = (p & 65535) + 1 & 255
            }
            if ((h | 0) == 17) {
                h = d + (o * 72 | 0) + 3512 | 0;
                e = Fe(e, c[h >> 2] | 0) | 0;
                if (!(a[d + (o * 72 | 0) + 3582 >> 0] & 8)) pc(d, h, 1);
                else pc(d, h, 9);
                t = (e | 0) < 0 ? e : 1;
                i = g;
                return t | 0
            } else if ((h | 0) == 23) {
                i = g;
                return d | 0
            }
            return 0
        }

        function wc(e) {
            e = e | 0;
            var f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0;
            g = i;
            f = e + 7618 | 0;
            h = e + 5816 | 0;
            k = 0;
            j = 0;
            do {
                if ((a[e + (j * 72 | 0) + 3582 >> 0] | 0) != 0 ? (b[e + (j * 72 | 0) + 3580 >> 1] | 0) == (b[f >> 1] | 0) : 0) k = ((c[e + (j * 72 | 0) + 3544 >> 2] | 0) != (c[h >> 2] | 0) & 1) + k | 0;
                j = j + 1 | 0
            } while ((j | 0) != 32);
            j = c[e + 200 >> 2] | 0;
            if (!j) {
                i = g;
                return
            }
            if ((k | 0) < (c[j + (((c[j + 72 >> 2] | 0) + -1 | 0) * 12 | 0) + 76 >> 2] | 0)) {
                i = g;
                return
            } else {
                k = 0;
                j = 2147483647
            }
            do {
                l = a[e + (k * 72 | 0) + 3582 >> 0] | 0;
                if (l << 24 >> 24 != 0 ? (b[e + (k * 72 | 0) + 3580 >> 1] | 0) == (b[f >> 1] | 0) : 0) {
                    m = c[e + (k * 72 | 0) + 3544 >> 2] | 0;
                    j = (l << 24 >> 24 == 1 ? (m | 0) != (c[h >> 2] | 0) : 0) & (m | 0) < (j | 0) ? m : j
                }
                k = k + 1 | 0
            } while ((k | 0) != 32);
            l = 0;
            do {
                k = e + (l * 72 | 0) + 3582 | 0;
                h = d[k >> 0] | 0;
                if (((h & 1 | 0) != 0 ? (b[e + (l * 72 | 0) + 3580 >> 1] | 0) == (b[f >> 1] | 0) : 0) ? (c[e + (l * 72 | 0) + 3544 >> 2] | 0) <= (j | 0) : 0) a[k >> 0] = h | 8;
                l = l + 1 | 0
            } while ((l | 0) != 32);
            i = g;
            return
        }

        function xc(b) {
            b = b | 0;
            var d = 0,
                e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0;
            d = i;
            i = i + 208 | 0;
            e = d + 12 | 0;
            g = d;
            l = (c[b + 2428 >> 2] | 0) == 0;
            f = b + 3508 | 0;
            k = c[f >> 2] | 0;
            o = c[k + 28 >> 2] | 0;
            j = c[(c[(c[b + 204 >> 2] | 0) + 1668 >> 2] | 0) + (c[b + 2420 >> 2] << 2) >> 2] | 0;
            n = c[b + 5824 >> 2] | 0;
            m = k + 64 | 0;
            r = c[m >> 2] | 0;
            if (n >>> 0 >= (((c[r + 8 >> 2] | 0) >>> 0) / 392 | 0) >>> 0) {
                A = -1094995529;
                i = d;
                return A | 0
            }
            p = k + 24 | 0;
            if ((j | 0) < (o | 0) ? (c[(c[p >> 2] | 0) + (j << 2) >> 2] = (c[r + 4 >> 2] | 0) + (n * 392 | 0), q = j + 1 | 0, (q | 0) != (o | 0)) : 0)
                do {
                    c[(c[p >> 2] | 0) + (q << 2) >> 2] = (c[(c[m >> 2] | 0) + 4 >> 2] | 0) + (n * 392 | 0);
                    q = q + 1 | 0
                } while ((q | 0) != (o | 0));
            c[k + 20 >> 2] = c[(c[p >> 2] | 0) + (j << 2) >> 2];
            if (((c[b + 1824 >> 2] | 0) + (c[b + 1628 >> 2] | 0) | 0) == (0 - (c[b + 2216 >> 2] | 0) | 0)) {
                A = -1094995529;
                i = d;
                return A | 0
            }
            q = l ? 2 : 1;
            n = g + 4 | 0;
            m = g + 8 | 0;
            o = e + 192 | 0;
            r = b + 3051 | 0;
            s = b + 3052 | 0;
            k = 0;
            l = 0;
            a: while (1) {
                jf(e | 0, 0, 196) | 0;
                j = c[(c[f >> 2] | 0) + 20 >> 2] | 0;
                u = j + (k * 196 | 0) | 0;
                p = l << 24 >> 24 != 0 & 1;
                c[g >> 2] = p;
                c[n >> 2] = p ^ 1;
                c[m >> 2] = 3;
                p = b + (k << 2) + 3036 | 0;
                t = c[p >> 2] | 0;
                if (!t) A = 0;
                else {
                    A = 0;
                    v = 0;
                    while (1) {
                        y = c[g + (v << 2) >> 2] | 0;
                        x = c[b + (y * 196 | 0) + 1628 >> 2] | 0;
                        b: do
                            if ((x | 0) > 0) {
                                w = (v | 0) == 2 & 1;
                                z = 0;
                                do {
                                    if ((A | 0) >= 16) break b;
                                    c[e + (A << 2) + 64 >> 2] = c[b + (y * 196 | 0) + (z << 2) + 1500 >> 2];
                                    c[e + (c[o >> 2] << 2) >> 2] = c[b + (y * 196 | 0) + (z << 2) + 1436 >> 2];
                                    c[e + (c[o >> 2] << 2) + 128 >> 2] = w;
                                    A = (c[o >> 2] | 0) + 1 | 0;
                                    c[o >> 2] = A;
                                    z = z + 1 | 0
                                } while ((z | 0) < (x | 0))
                            }
                        while (0);
                        v = v + 1 | 0;
                        if ((v | 0) != 3) continue;
                        if (A >>> 0 < t >>> 0) v = 0;
                        else break
                    }
                }
                if (a[b + k + 3032 >> 0] | 0) {
                    if (t) {
                        t = j + (k * 196 | 0) + 192 | 0;
                        v = 0;
                        do {
                            u = c[b + (k << 7) + (v << 2) + 2776 >> 2] | 0;
                            if ((u | 0) >= (A | 0)) {
                                e = -1094995529;
                                b = 24;
                                break a
                            }
                            c[j + (k * 196 | 0) + (v << 2) + 64 >> 2] = c[e + (u << 2) + 64 >> 2];
                            c[j + (k * 196 | 0) + (v << 2) >> 2] = c[e + (u << 2) >> 2];
                            c[j + (k * 196 | 0) + (v << 2) + 128 >> 2] = c[e + (u << 2) + 128 >> 2];
                            c[t >> 2] = (c[t >> 2] | 0) + 1;
                            v = v + 1 | 0
                        } while (v >>> 0 < (c[p >> 2] | 0) >>> 0)
                    }
                } else {
                    mf(u | 0, e | 0, 196) | 0;
                    A = j + (k * 196 | 0) + 192 | 0;
                    z = c[A >> 2] | 0;
                    y = c[p >> 2] | 0;
                    c[A >> 2] = z >>> 0 > y >>> 0 ? y : z
                }
                if ((a[r >> 0] | 0) == l << 24 >> 24 ? (h = c[s >> 2] | 0, h >>> 0 < (c[j + (k * 196 | 0) + 192 >> 2] | 0) >>> 0) : 0) c[(c[f >> 2] | 0) + 36 >> 2] = c[j + (k * 196 | 0) + (h << 2) >> 2];
                l = l + 1 << 24 >> 24;
                k = l & 255;
                if (k >>> 0 >= q >>> 0) {
                    e = 0;
                    b = 24;
                    break
                }
            }
            if ((b | 0) == 24) {
                i = d;
                return e | 0
            }
            return 0
        }

        function yc(b) {
            b = b | 0;
            var e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0;
            e = i;
            f = c[b + 2608 >> 2] | 0;
            if (!f) {
                c[b + 1824 >> 2] = 0;
                c[b + 1628 >> 2] = 0;
                k = 0;
                i = e;
                return k | 0
            }
            h = b + 3508 | 0;
            g = 0;
            do {
                if ((b + (g * 72 | 0) + 3512 | 0) != (c[h >> 2] | 0)) {
                    k = b + (g * 72 | 0) + 3582 | 0;
                    a[k >> 0] = d[k >> 0] & 249
                }
                g = g + 1 | 0
            } while ((g | 0) != 32);
            c[b + 1628 >> 2] = 0;
            c[b + 1824 >> 2] = 0;
            c[b + 2020 >> 2] = 0;
            c[b + 2216 >> 2] = 0;
            c[b + 2412 >> 2] = 0;
            j = f + 4 | 0;
            a: do
                if ((c[j >> 2] | 0) > 0) {
                    g = b + 5816 | 0;
                    h = 0;
                    while (1) {
                        if (!(a[f + h + 136 >> 0] | 0)) k = 2;
                        else k = h >>> 0 >= (c[f >> 2] | 0) >>> 0 & 1;
                        k = zc(b, b + (k * 196 | 0) + 1436 | 0, (c[f + (h << 2) + 8 >> 2] | 0) + (c[g >> 2] | 0) | 0, 2) | 0;
                        h = h + 1 | 0;
                        if ((k | 0) < 0) break;
                        if ((h | 0) >= (c[j >> 2] | 0)) break a
                    }
                    i = e;
                    return k | 0
                }
            while (0);
            f = b + 2772 | 0;
            b: do
                if (!(a[f >> 0] | 0)) f = 0;
                else {
                    g = 0;
                    while (1) {
                        k = zc(b, b + (((a[b + g + 2740 >> 0] | 0) != 0 ? 3 : 4) * 196 | 0) + 1436 | 0, c[b + (g << 2) + 2612 >> 2] | 0, 4) | 0;
                        g = g + 1 | 0;
                        if ((k | 0) < 0) break;
                        if ((g | 0) >= (d[f >> 0] | 0)) {
                            f = 0;
                            break b
                        }
                    }
                    i = e;
                    return k | 0
                }
            while (0);
            do {
                pc(b, b + (f * 72 | 0) + 3512 | 0, 0);
                f = f + 1 | 0
            } while ((f | 0) != 32);
            k = 0;
            i = e;
            return k | 0
        }

        function zc(e, f, g, h) {
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            var j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0;
            j = i;
            k = e + 200 | 0;
            o = (1 << c[(c[k >> 2] | 0) + 64 >> 2]) + -1 | 0;
            l = e + 7616 | 0;
            q = 0;
            while (1) {
                m = e + (q * 72 | 0) + 3512 | 0;
                if (((c[(c[m >> 2] | 0) + 304 >> 2] | 0) != 0 ? (b[e + (q * 72 | 0) + 3580 >> 1] | 0) == (b[l >> 1] | 0) : 0) ? (c[e + (q * 72 | 0) + 3544 >> 2] & o | 0) == (g | 0) : 0) break;
                q = q + 1 | 0;
                if (q >>> 0 >= 32) {
                    q = 0;
                    p = 6;
                    break
                }
            }
            a: do
                if ((p | 0) == 6)
                    while (1) {
                        m = e + (q * 72 | 0) + 3512 | 0;
                        if ((c[(c[m >> 2] | 0) + 304 >> 2] | 0) != 0 ? (b[e + (q * 72 | 0) + 3580 >> 1] | 0) == (b[l >> 1] | 0) : 0) {
                            p = c[e + (q * 72 | 0) + 3544 >> 2] | 0;
                            if ((p | 0) == (g | 0)) break a;
                            if ((p & o | 0) == (g | 0)) break a
                        }
                        q = q + 1 | 0;
                        if (q >>> 0 >= 32) {
                            m = 0;
                            break
                        } else p = 6
                    }
                while (0);
            if ((m | 0) == (c[e + 3508 >> 2] | 0)) {
                q = -1094995529;
                i = j;
                return q | 0
            }
            if (!m) {
                m = uc(e) | 0;
                if (!m) {
                    q = -12;
                    i = j;
                    return q | 0
                }
                p = c[k >> 2] | 0;
                o = c[m >> 2] | 0;
                if (!(c[p + 56 >> 2] | 0)) {
                    o = c[o + 304 >> 2] | 0;
                    if ((o | 0) != 0 ? (jf(c[o + 4 >> 2] | 0, 1 << (c[p + 52 >> 2] | 0) + -1 & 255 | 0, c[o + 8 >> 2] | 0) | 0, n = c[(c[m >> 2] | 0) + 308 >> 2] | 0, (n | 0) != 0) : 0) {
                        o = 1;
                        do {
                            o = o + 1 | 0;
                            jf(c[n + 4 >> 2] | 0, 1 << (c[(c[k >> 2] | 0) + 52 >> 2] | 0) + -1 & 255 | 0, c[n + 8 >> 2] | 0) | 0;
                            n = c[(c[m >> 2] | 0) + (o << 2) + 304 >> 2] | 0
                        } while ((n | 0) != 0)
                    }
                } else if (c[o >> 2] | 0) {
                    n = 0;
                    do {
                        if ((c[p + 13124 >> 2] >> c[p + (n << 2) + 13180 >> 2] | 0) > 0) {
                            o = 0;
                            do {
                                if ((c[p + 13120 >> 2] >> c[p + (n << 2) + 13168 >> 2] | 0) > 0) {
                                    q = p;
                                    p = 0;
                                    do {
                                        r = 1 << (c[q + 52 >> 2] | 0) + -1 & 65535;
                                        q = c[m >> 2] | 0;
                                        q = (c[q + (n << 2) >> 2] | 0) + (($(c[q + (n << 2) + 32 >> 2] | 0, o) | 0) + (p << 1)) | 0;
                                        a[q >> 0] = r;
                                        a[q + 1 >> 0] = r >> 8;
                                        p = p + 1 | 0;
                                        q = c[k >> 2] | 0
                                    } while ((p | 0) < (c[q + 13120 >> 2] >> c[q + (n << 2) + 13168 >> 2] | 0));
                                    p = q
                                }
                                o = o + 1 | 0
                            } while ((o | 0) < (c[p + 13124 >> 2] >> c[p + (n << 2) + 13180 >> 2] | 0));
                            o = c[m >> 2] | 0
                        }
                        n = n + 1 | 0
                    } while ((c[o + (n << 2) >> 2] | 0) != 0)
                }
                c[m + 32 >> 2] = g;
                b[m + 68 >> 1] = b[l >> 1] | 0;
                a[m + 70 >> 0] = 0
            }
            r = f + 192 | 0;
            c[f + (c[r >> 2] << 2) + 64 >> 2] = c[m + 32 >> 2];
            c[f + (c[r >> 2] << 2) >> 2] = m;
            c[r >> 2] = (c[r >> 2] | 0) + 1;
            r = m + 70 | 0;
            a[r >> 0] = d[r >> 0] & 249 | h;
            r = 0;
            i = j;
            return r | 0
        }

        function Ac(a, b) {
            a = a | 0;
            b = b | 0;
            var d = 0,
                e = 0,
                f = 0,
                g = 0;
            d = i;
            e = 1 << c[(c[a + 200 >> 2] | 0) + 64 >> 2];
            f = c[a + 5820 >> 2] | 0;
            g = (f | 0) % (e | 0) | 0;
            f = f - g | 0;
            if ((g | 0) > (b | 0) ? (g - b | 0) >= ((e | 0) / 2 | 0 | 0) : 0) f = f + e | 0;
            else if ((g | 0) < (b | 0)) f = f - ((b - g | 0) > ((e | 0) / 2 | 0 | 0) ? e : 0) | 0;
            i = d;
            return (((c[a + 3500 >> 2] | 0) + -16 | 0) >>> 0 < 3 ? 0 : f) + b | 0
        }

        function Bc(b) {
            b = b | 0;
            var d = 0,
                e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0;
            d = i;
            e = c[b + 2608 >> 2] | 0;
            if (e) {
                j = c[e >> 2] | 0;
                if (!j) {
                    g = 0;
                    h = 0
                } else {
                    g = j >>> 0 > 1;
                    h = 0;
                    f = 0;
                    do {
                        f = ((a[e + h + 136 >> 0] | 0) != 0 & 1) + f | 0;
                        h = h + 1 | 0
                    } while (h >>> 0 < j >>> 0);
                    g = g ? j : 1;
                    h = f
                }
                f = c[e + 4 >> 2] | 0;
                if ((g | 0) < (f | 0))
                    do {
                        h = ((a[e + g + 136 >> 0] | 0) != 0 & 1) + h | 0;
                        g = g + 1 | 0
                    } while ((g | 0) < (f | 0))
            } else h = 0;
            e = a[b + 2772 >> 0] | 0;
            if (!(e << 24 >> 24)) {
                j = h;
                i = d;
                return j | 0
            }
            f = e & 255;
            e = 0;
            do {
                h = ((a[b + e + 2740 >> 0] | 0) != 0 & 1) + h | 0;
                e = e + 1 | 0
            } while ((e | 0) < (f | 0));
            i = d;
            return h | 0
        }

        function Cc() {
            var b = 0,
                c = 0,
                d = 0,
                e = 0,
                f = 0;
            b = i;
            if (!(a[1752] | 0)) c = 0;
            else {
                i = b;
                return
            }
            do {
                d = 0;
                do {
                    f = ($(d << 1 | 1, c) | 0) & 127;
                    e = f >>> 0 > 63;
                    f = e ? f + -64 | 0 : f;
                    e = e ? -1 : 1;
                    if ((f | 0) > 31) {
                        f = 64 - f | 0;
                        e = 0 - e | 0
                    }
                    a[1752 + (c << 5) + d >> 0] = $(a[2776 + f >> 0] | 0, e) | 0;
                    d = d + 1 | 0
                } while ((d | 0) != 32);
                c = c + 1 | 0
            } while ((c | 0) != 32);
            i = b;
            return
        }

        function Dc(a, b) {
            a = a | 0;
            b = b | 0;
            c[a >> 2] = 1;
            c[a + 4 >> 2] = 1;
            c[a + 8 >> 2] = 2;
            c[a + 12 >> 2] = 3;
            c[a + 16 >> 2] = 4;
            c[a + 20 >> 2] = 1;
            c[a + 24 >> 2] = 5;
            c[a + 28 >> 2] = 2;
            c[a + 32 >> 2] = 2;
            c[a + 36 >> 2] = 3;
            c[a + 40 >> 2] = 4;
            c[a + 44 >> 2] = 5;
            c[a + 48 >> 2] = 3;
            c[a + 52 >> 2] = 4;
            c[a + 56 >> 2] = 5;
            c[a + 60 >> 2] = 6;
            c[a + 236 >> 2] = 1;
            c[a + 252 >> 2] = 1;
            c[a + 268 >> 2] = 1;
            c[a + 284 >> 2] = 1;
            c[a + 300 >> 2] = 1;
            c[a + 316 >> 2] = 1;
            c[a + 332 >> 2] = 1;
            c[a + 348 >> 2] = 1;
            c[a + 364 >> 2] = 1;
            c[a + 380 >> 2] = 1;
            c[a + 240 >> 2] = 2;
            c[a + 256 >> 2] = 2;
            c[a + 272 >> 2] = 2;
            c[a + 288 >> 2] = 2;
            c[a + 304 >> 2] = 2;
            c[a + 320 >> 2] = 2;
            c[a + 336 >> 2] = 2;
            c[a + 352 >> 2] = 2;
            c[a + 368 >> 2] = 2;
            c[a + 384 >> 2] = 2;
            c[a + 244 >> 2] = 3;
            c[a + 260 >> 2] = 3;
            c[a + 276 >> 2] = 3;
            c[a + 292 >> 2] = 3;
            c[a + 308 >> 2] = 3;
            c[a + 324 >> 2] = 3;
            c[a + 340 >> 2] = 3;
            c[a + 356 >> 2] = 3;
            c[a + 372 >> 2] = 3;
            c[a + 388 >> 2] = 3;
            c[a + 248 >> 2] = 4;
            c[a + 264 >> 2] = 4;
            c[a + 280 >> 2] = 4;
            c[a + 296 >> 2] = 4;
            c[a + 312 >> 2] = 4;
            c[a + 328 >> 2] = 4;
            c[a + 344 >> 2] = 4;
            c[a + 360 >> 2] = 4;
            c[a + 376 >> 2] = 4;
            c[a + 392 >> 2] = 4;
            c[a + 396 >> 2] = 1;
            c[a + 412 >> 2] = 1;
            c[a + 428 >> 2] = 1;
            c[a + 444 >> 2] = 1;
            c[a + 460 >> 2] = 1;
            c[a + 476 >> 2] = 1;
            c[a + 492 >> 2] = 1;
            c[a + 508 >> 2] = 1;
            c[a + 524 >> 2] = 1;
            c[a + 540 >> 2] = 1;
            c[a + 400 >> 2] = 2;
            c[a + 416 >> 2] = 2;
            c[a + 432 >> 2] = 2;
            c[a + 448 >> 2] = 2;
            c[a + 464 >> 2] = 2;
            c[a + 480 >> 2] = 2;
            c[a + 496 >> 2] = 2;
            c[a + 512 >> 2] = 2;
            c[a + 528 >> 2] = 2;
            c[a + 544 >> 2] = 2;
            c[a + 404 >> 2] = 3;
            c[a + 420 >> 2] = 3;
            c[a + 436 >> 2] = 3;
            c[a + 452 >> 2] = 3;
            c[a + 468 >> 2] = 3;
            c[a + 484 >> 2] = 3;
            c[a + 500 >> 2] = 3;
            c[a + 516 >> 2] = 3;
            c[a + 532 >> 2] = 3;
            c[a + 548 >> 2] = 3;
            c[a + 408 >> 2] = 4;
            c[a + 424 >> 2] = 4;
            c[a + 440 >> 2] = 4;
            c[a + 456 >> 2] = 4;
            c[a + 472 >> 2] = 4;
            c[a + 488 >> 2] = 4;
            c[a + 504 >> 2] = 4;
            c[a + 520 >> 2] = 4;
            c[a + 536 >> 2] = 4;
            c[a + 552 >> 2] = 4;
            c[a + 1036 >> 2] = 1;
            c[a + 1052 >> 2] = 1;
            c[a + 1068 >> 2] = 1;
            c[a + 1084 >> 2] = 1;
            c[a + 1100 >> 2] = 1;
            c[a + 1116 >> 2] = 1;
            c[a + 1132 >> 2] = 1;
            c[a + 1148 >> 2] = 1;
            c[a + 1164 >> 2] = 1;
            c[a + 1180 >> 2] = 1;
            c[a + 1040 >> 2] = 5;
            c[a + 1056 >> 2] = 5;
            c[a + 1072 >> 2] = 5;
            c[a + 1088 >> 2] = 5;
            c[a + 1104 >> 2] = 5;
            c[a + 1120 >> 2] = 5;
            c[a + 1136 >> 2] = 5;
            c[a + 1152 >> 2] = 5;
            c[a + 1168 >> 2] = 5;
            c[a + 1184 >> 2] = 5;
            c[a + 1044 >> 2] = 6;
            c[a + 1060 >> 2] = 6;
            c[a + 1076 >> 2] = 6;
            c[a + 1092 >> 2] = 6;
            c[a + 1108 >> 2] = 6;
            c[a + 1124 >> 2] = 6;
            c[a + 1140 >> 2] = 6;
            c[a + 1156 >> 2] = 6;
            c[a + 1172 >> 2] = 6;
            c[a + 1188 >> 2] = 6;
            c[a + 1048 >> 2] = 7;
            c[a + 1064 >> 2] = 7;
            c[a + 1080 >> 2] = 7;
            c[a + 1096 >> 2] = 7;
            c[a + 1112 >> 2] = 7;
            c[a + 1128 >> 2] = 7;
            c[a + 1144 >> 2] = 7;
            c[a + 1160 >> 2] = 7;
            c[a + 1176 >> 2] = 7;
            c[a + 1192 >> 2] = 7;
            c[a + 1196 >> 2] = 1;
            c[a + 1212 >> 2] = 1;
            c[a + 1228 >> 2] = 1;
            c[a + 1244 >> 2] = 1;
            c[a + 1260 >> 2] = 1;
            c[a + 1276 >> 2] = 1;
            c[a + 1292 >> 2] = 1;
            c[a + 1308 >> 2] = 1;
            c[a + 1324 >> 2] = 1;
            c[a + 1340 >> 2] = 1;
            c[a + 1200 >> 2] = 5;
            c[a + 1216 >> 2] = 5;
            c[a + 1232 >> 2] = 5;
            c[a + 1248 >> 2] = 5;
            c[a + 1264 >> 2] = 5;
            c[a + 1280 >> 2] = 5;
            c[a + 1296 >> 2] = 5;
            c[a + 1312 >> 2] = 5;
            c[a + 1328 >> 2] = 5;
            c[a + 1344 >> 2] = 5;
            c[a + 1204 >> 2] = 6;
            c[a + 1220 >> 2] = 6;
            c[a + 1236 >> 2] = 6;
            c[a + 1252 >> 2] = 6;
            c[a + 1268 >> 2] = 6;
            c[a + 1284 >> 2] = 6;
            c[a + 1300 >> 2] = 6;
            c[a + 1316 >> 2] = 6;
            c[a + 1332 >> 2] = 6;
            c[a + 1348 >> 2] = 6;
            c[a + 1208 >> 2] = 7;
            c[a + 1224 >> 2] = 7;
            c[a + 1240 >> 2] = 7;
            c[a + 1256 >> 2] = 7;
            c[a + 1272 >> 2] = 7;
            c[a + 1288 >> 2] = 7;
            c[a + 1304 >> 2] = 7;
            c[a + 1320 >> 2] = 7;
            c[a + 1336 >> 2] = 7;
            c[a + 1352 >> 2] = 7;
            c[a + 64 >> 2] = 1;
            c[a + 68 >> 2] = 1;
            c[a + 72 >> 2] = 2;
            c[a + 1676 >> 2] = 2;
            c[a + 1680 >> 2] = 3;
            c[a + 1684 >> 2] = 1;
            c[a + 1688 >> 2] = 2;
            c[a + 1692 >> 2] = 2;
            c[a + 1696 >> 2] = 3;
            c[a + 1700 >> 2] = 1;
            c[a + 1704 >> 2] = 2;
            return
        }

        function Ec(b, c, d, e, f, g) {
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            var h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0;
            h = i;
            if ((e | 0) <= 0) {
                i = h;
                return
            }
            k = (d | 0) > 0;
            j = 8 - g | 0;
            m = 0;
            while (1) {
                if (k) {
                    l = 0;
                    do {
                        a[b + l >> 0] = (Xd(f, g) | 0) << j;
                        l = l + 1 | 0
                    } while ((l | 0) != (d | 0))
                }
                m = m + 1 | 0;
                if ((m | 0) == (e | 0)) break;
                else b = b + c | 0
            }
            i = h;
            return
        }

        function Fc(c, e, f) {
            c = c | 0;
            e = e | 0;
            f = f | 0;
            var g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0;
            g = i;
            h = 0;
            while (1) {
                j = e;
                k = 0;
                while (1) {
                    l = c + k | 0;
                    m = (b[j >> 1] | 0) + (d[l >> 0] | 0) | 0;
                    if (m >>> 0 > 255) m = 0 - m >> 31;
                    a[l >> 0] = m;
                    k = k + 1 | 0;
                    if ((k | 0) == 4) break;
                    else j = j + 2 | 0
                }
                h = h + 1 | 0;
                if ((h | 0) == 4) break;
                else {
                    e = e + 8 | 0;
                    c = c + f | 0
                }
            }
            i = g;
            return
        }

        function Gc(c, e, f) {
            c = c | 0;
            e = e | 0;
            f = f | 0;
            var g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0;
            g = i;
            h = 0;
            while (1) {
                j = e;
                k = 0;
                while (1) {
                    l = c + k | 0;
                    m = (b[j >> 1] | 0) + (d[l >> 0] | 0) | 0;
                    if (m >>> 0 > 255) m = 0 - m >> 31;
                    a[l >> 0] = m;
                    k = k + 1 | 0;
                    if ((k | 0) == 8) break;
                    else j = j + 2 | 0
                }
                h = h + 1 | 0;
                if ((h | 0) == 8) break;
                else {
                    e = e + 16 | 0;
                    c = c + f | 0
                }
            }
            i = g;
            return
        }

        function Hc(c, e, f) {
            c = c | 0;
            e = e | 0;
            f = f | 0;
            var g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0;
            g = i;
            h = 0;
            while (1) {
                j = e;
                k = 0;
                while (1) {
                    l = c + k | 0;
                    m = (b[j >> 1] | 0) + (d[l >> 0] | 0) | 0;
                    if (m >>> 0 > 255) m = 0 - m >> 31;
                    a[l >> 0] = m;
                    k = k + 1 | 0;
                    if ((k | 0) == 16) break;
                    else j = j + 2 | 0
                }
                h = h + 1 | 0;
                if ((h | 0) == 16) break;
                else {
                    e = e + 32 | 0;
                    c = c + f | 0
                }
            }
            i = g;
            return
        }

        function Ic(c, e, f) {
            c = c | 0;
            e = e | 0;
            f = f | 0;
            var g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0;
            g = i;
            h = 0;
            while (1) {
                j = e;
                k = 0;
                while (1) {
                    l = c + k | 0;
                    m = (b[j >> 1] | 0) + (d[l >> 0] | 0) | 0;
                    if (m >>> 0 > 255) m = 0 - m >> 31;
                    a[l >> 0] = m;
                    k = k + 1 | 0;
                    if ((k | 0) == 32) break;
                    else j = j + 2 | 0
                }
                h = h + 1 | 0;
                if ((h | 0) == 32) break;
                else {
                    e = e + 64 | 0;
                    c = c + f | 0
                }
            }
            i = g;
            return
        }

        function Jc(a, c) {
            a = a | 0;
            c = c | 0;
            var d = 0,
                e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0;
            d = i;
            c = c << 16 >> 16;
            e = 7 - c | 0;
            c = 1 << c;
            if ((e | 0) > 0) {
                f = 1 << e + -1;
                if ((c | 0) > 0) g = 0;
                else {
                    i = d;
                    return
                }
                while (1) {
                    h = a;
                    j = 0;
                    while (1) {
                        b[h >> 1] = (b[h >> 1] | 0) + f >> e;
                        j = j + 1 | 0;
                        if ((j | 0) == (c | 0)) break;
                        else h = h + 2 | 0
                    }
                    g = g + 1 | 0;
                    if ((g | 0) == (c | 0)) break;
                    else a = a + (c << 1) | 0
                }
                i = d;
                return
            }
            if ((c | 0) <= 0) {
                i = d;
                return
            }
            e = 0 - e | 0;
            f = 0;
            while (1) {
                g = a;
                h = 0;
                while (1) {
                    b[g >> 1] = b[g >> 1] << e;
                    h = h + 1 | 0;
                    if ((h | 0) == (c | 0)) break;
                    else g = g + 2 | 0
                }
                f = f + 1 | 0;
                if ((f | 0) == (c | 0)) break;
                else a = a + (c << 1) | 0
            }
            i = d;
            return
        }

        function Kc(a, c, d) {
            a = a | 0;
            c = c | 0;
            d = d | 0;
            var f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0;
            f = i;
            c = 1 << (c << 16 >> 16);
            if (d) {
                d = c + -1 | 0;
                if ((d | 0) <= 0) {
                    i = f;
                    return
                }
                g = (c | 0) > 0;
                h = 0;
                do {
                    if (g) {
                        j = 0;
                        do {
                            k = a + (j + c << 1) | 0;
                            b[k >> 1] = (e[k >> 1] | 0) + (e[a + (j << 1) >> 1] | 0);
                            j = j + 1 | 0
                        } while ((j | 0) != (c | 0))
                    }
                    a = a + (c << 1) | 0;
                    h = h + 1 | 0
                } while ((h | 0) != (d | 0));
                i = f;
                return
            }
            if ((c | 0) <= 0) {
                i = f;
                return
            }
            d = (c | 0) > 1;
            h = 0;
            while (1) {
                if (d) {
                    j = b[a >> 1] | 0;
                    g = 1;
                    do {
                        k = a + (g << 1) | 0;
                        j = (e[k >> 1] | 0) + (j & 65535) & 65535;
                        b[k >> 1] = j;
                        g = g + 1 | 0
                    } while ((g | 0) != (c | 0))
                }
                h = h + 1 | 0;
                if ((h | 0) == (c | 0)) break;
                else a = a + (c << 1) | 0
            }
            i = f;
            return
        }

        function Lc(a) {
            a = a | 0;
            var c = 0,
                d = 0,
                e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0;
            c = i;
            e = 0;
            d = a;
            while (1) {
                p = b[d >> 1] | 0;
                m = d + 16 | 0;
                n = b[m >> 1] | 0;
                g = n + p | 0;
                f = d + 24 | 0;
                o = b[f >> 1] | 0;
                l = o + n | 0;
                j = p - o | 0;
                h = d + 8 | 0;
                k = (b[h >> 1] | 0) * 74 | 0;
                o = ((p - n + o | 0) * 74 | 0) + 64 | 0;
                n = o >> 7;
                if ((n + 32768 | 0) >>> 0 > 65535) n = o >> 31 ^ 32767;
                b[m >> 1] = n;
                m = (g * 29 | 0) + 64 + (l * 55 | 0) + k | 0;
                n = m >> 7;
                if ((n + 32768 | 0) >>> 0 > 65535) n = m >> 31 ^ 32767;
                b[d >> 1] = n;
                l = ($(l, -29) | 0) + 64 + (j * 55 | 0) + k | 0;
                m = l >> 7;
                if ((m + 32768 | 0) >>> 0 > 65535) m = l >> 31 ^ 32767;
                b[h >> 1] = m;
                g = (g * 55 | 0) + 64 + (j * 29 | 0) - k | 0;
                h = g >> 7;
                if ((h + 32768 | 0) >>> 0 > 65535) h = g >> 31 ^ 32767;
                b[f >> 1] = h;
                e = e + 1 | 0;
                if ((e | 0) == 4) {
                    d = 0;
                    break
                } else d = d + 2 | 0
            }
            while (1) {
                p = b[a >> 1] | 0;
                l = a + 4 | 0;
                m = b[l >> 1] | 0;
                g = m + p | 0;
                e = a + 6 | 0;
                n = b[e >> 1] | 0;
                k = n + m | 0;
                h = p - n | 0;
                f = a + 2 | 0;
                j = (b[f >> 1] | 0) * 74 | 0;
                n = ((p - m + n | 0) * 74 | 0) + 2048 | 0;
                m = n >> 12;
                if ((m + 32768 | 0) >>> 0 > 65535) m = n >> 31 ^ 32767;
                b[l >> 1] = m;
                l = (g * 29 | 0) + 2048 + (k * 55 | 0) + j | 0;
                m = l >> 12;
                if ((m + 32768 | 0) >>> 0 > 65535) m = l >> 31 ^ 32767;
                b[a >> 1] = m;
                k = ($(k, -29) | 0) + 2048 + (h * 55 | 0) + j | 0;
                l = k >> 12;
                if ((l + 32768 | 0) >>> 0 > 65535) l = k >> 31 ^ 32767;
                b[f >> 1] = l;
                f = (g * 55 | 0) + 2048 + (h * 29 | 0) - j | 0;
                g = f >> 12;
                if ((g + 32768 | 0) >>> 0 > 65535) g = f >> 31 ^ 32767;
                b[e >> 1] = g;
                d = d + 1 | 0;
                if ((d | 0) == 4) break;
                else a = a + 8 | 0
            }
            i = c;
            return
        }

        function Mc(a, c) {
            a = a | 0;
            c = c | 0;
            var d = 0,
                e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0;
            c = i;
            f = 0;
            e = a;
            while (1) {
                l = b[e >> 1] << 6;
                j = e + 16 | 0;
                k = b[j >> 1] << 6;
                g = k + l | 0;
                k = l - k | 0;
                l = e + 8 | 0;
                m = b[l >> 1] | 0;
                d = e + 24 | 0;
                n = b[d >> 1] | 0;
                h = (n * 36 | 0) + (m * 83 | 0) | 0;
                m = ($(n, -83) | 0) + (m * 36 | 0) | 0;
                n = g + 64 + h | 0;
                o = n >> 7;
                if ((o + 32768 | 0) >>> 0 > 65535) o = n >> 31 ^ 32767;
                b[e >> 1] = o;
                o = k + 64 + m | 0;
                n = o >> 7;
                if ((n + 32768 | 0) >>> 0 > 65535) n = o >> 31 ^ 32767;
                b[l >> 1] = n;
                l = k - m + 64 | 0;
                k = l >> 7;
                if ((k + 32768 | 0) >>> 0 > 65535) k = l >> 31 ^ 32767;
                b[j >> 1] = k;
                h = g - h + 64 | 0;
                g = h >> 7;
                if ((g + 32768 | 0) >>> 0 > 65535) g = h >> 31 ^ 32767;
                b[d >> 1] = g;
                f = f + 1 | 0;
                if ((f | 0) == 4) {
                    e = 0;
                    break
                } else e = e + 2 | 0
            }
            while (1) {
                k = b[a >> 1] << 6;
                h = a + 4 | 0;
                l = b[h >> 1] << 6;
                g = l + k | 0;
                l = k - l | 0;
                k = a + 2 | 0;
                j = b[k >> 1] | 0;
                d = a + 6 | 0;
                m = b[d >> 1] | 0;
                f = (m * 36 | 0) + (j * 83 | 0) | 0;
                j = ($(m, -83) | 0) + (j * 36 | 0) | 0;
                m = g + 2048 + f | 0;
                n = m >> 12;
                if ((n + 32768 | 0) >>> 0 > 65535) n = m >> 31 ^ 32767;
                b[a >> 1] = n;
                m = l + 2048 + j | 0;
                n = m >> 12;
                if ((n + 32768 | 0) >>> 0 > 65535) n = m >> 31 ^ 32767;
                b[k >> 1] = n;
                k = l - j + 2048 | 0;
                j = k >> 12;
                if ((j + 32768 | 0) >>> 0 > 65535) j = k >> 31 ^ 32767;
                b[h >> 1] = j;
                f = g - f + 2048 | 0;
                g = f >> 12;
                if ((g + 32768 | 0) >>> 0 > 65535) g = f >> 31 ^ 32767;
                b[d >> 1] = g;
                e = e + 1 | 0;
                if ((e | 0) == 4) break;
                else a = a + 8 | 0
            }
            i = c;
            return
        }

        function Nc(d, e) {
            d = d | 0;
            e = e | 0;
            var f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0;
            h = i;
            i = i + 64 | 0;
            j = h + 48 | 0;
            p = h + 32 | 0;
            f = h + 16 | 0;
            g = h;
            q = (e | 0) > 8;
            r = e + 4 | 0;
            k = j + 4 | 0;
            l = j + 8 | 0;
            m = j + 12 | 0;
            o = 0;
            r = (r | 0) > 8 ? 8 : r;
            n = d;
            while (1) {
                c[p + 0 >> 2] = 0;
                c[p + 4 >> 2] = 0;
                c[p + 8 >> 2] = 0;
                c[p + 12 >> 2] = 0;
                w = (r | 0) > 1;
                s = 0;
                do {
                    if (w) {
                        t = p + (s << 2) | 0;
                        v = c[t >> 2] | 0;
                        u = 1;
                        do {
                            v = ($(b[n + (u << 3 << 1) >> 1] | 0, a[1752 + (u << 2 << 5) + s >> 0] | 0) | 0) + v | 0;
                            u = u + 2 | 0
                        } while ((u | 0) < (r | 0));
                        c[t >> 2] = v
                    }
                    s = s + 1 | 0
                } while ((s | 0) != 4);
                v = b[n >> 1] << 6;
                u = b[n + 64 >> 1] << 6;
                w = u + v | 0;
                u = v - u | 0;
                v = b[n + 32 >> 1] | 0;
                t = b[n + 96 >> 1] | 0;
                s = (t * 36 | 0) + (v * 83 | 0) | 0;
                v = ($(t, -83) | 0) + (v * 36 | 0) | 0;
                t = s + w | 0;
                c[j >> 2] = t;
                c[k >> 2] = v + u;
                c[l >> 2] = u - v;
                c[m >> 2] = w - s;
                s = 0;
                while (1) {
                    u = c[p + (s << 2) >> 2] | 0;
                    v = t + 64 + u | 0;
                    w = v >> 7;
                    if ((w + 32768 | 0) >>> 0 > 65535) w = v >> 31 ^ 32767;
                    b[n + (s << 3 << 1) >> 1] = w;
                    t = t - u + 64 | 0;
                    u = t >> 7;
                    if ((u + 32768 | 0) >>> 0 > 65535) u = t >> 31 ^ 32767;
                    b[n + (7 - s << 3 << 1) >> 1] = u;
                    s = s + 1 | 0;
                    if ((s | 0) == 4) break;
                    t = c[j + (s << 2) >> 2] | 0
                }
                if ((r | 0) < 8) r = (o & 3 | 0) == 0 & (o | 0) != 0 ? r + -4 | 0 : r;
                o = o + 1 | 0;
                if ((o | 0) == 8) break;
                else n = n + 2 | 0
            }
            j = q ? 8 : e;
            n = (j | 0) > 1;
            k = f + 4 | 0;
            l = f + 8 | 0;
            m = f + 12 | 0;
            o = 0;
            while (1) {
                c[g + 0 >> 2] = 0;
                c[g + 4 >> 2] = 0;
                c[g + 8 >> 2] = 0;
                c[g + 12 >> 2] = 0;
                e = 0;
                do {
                    if (n) {
                        r = g + (e << 2) | 0;
                        p = c[r >> 2] | 0;
                        q = 1;
                        do {
                            p = ($(b[d + (q << 1) >> 1] | 0, a[1752 + (q << 2 << 5) + e >> 0] | 0) | 0) + p | 0;
                            q = q + 2 | 0
                        } while ((q | 0) < (j | 0));
                        c[r >> 2] = p
                    }
                    e = e + 1 | 0
                } while ((e | 0) != 4);
                v = b[d >> 1] << 6;
                u = b[d + 8 >> 1] << 6;
                w = u + v | 0;
                u = v - u | 0;
                v = b[d + 4 >> 1] | 0;
                p = b[d + 12 >> 1] | 0;
                e = (p * 36 | 0) + (v * 83 | 0) | 0;
                v = ($(p, -83) | 0) + (v * 36 | 0) | 0;
                p = e + w | 0;
                c[f >> 2] = p;
                c[k >> 2] = v + u;
                c[l >> 2] = u - v;
                c[m >> 2] = w - e;
                e = 0;
                while (1) {
                    q = c[g + (e << 2) >> 2] | 0;
                    r = p + 2048 + q | 0;
                    s = r >> 12;
                    if ((s + 32768 | 0) >>> 0 > 65535) s = r >> 31 ^ 32767;
                    b[d + (e << 1) >> 1] = s;
                    p = p - q + 2048 | 0;
                    q = p >> 12;
                    if ((q + 32768 | 0) >>> 0 > 65535) q = p >> 31 ^ 32767;
                    b[d + (7 - e << 1) >> 1] = q;
                    e = e + 1 | 0;
                    if ((e | 0) == 4) break;
                    p = c[f + (e << 2) >> 2] | 0
                }
                o = o + 1 | 0;
                if ((o | 0) == 8) break;
                else d = d + 16 | 0
            }
            i = h;
            return
        }

        function Oc(d, e) {
            d = d | 0;
            e = e | 0;
            var f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0;
            j = i;
            i = i + 192 | 0;
            t = j + 160 | 0;
            u = j + 128 | 0;
            m = j + 112 | 0;
            l = j + 96 | 0;
            g = j + 64 | 0;
            h = j + 32 | 0;
            f = j + 16 | 0;
            k = j;
            s = (e | 0) > 16;
            v = e + 4 | 0;
            n = m + 4 | 0;
            o = m + 8 | 0;
            p = m + 12 | 0;
            r = 0;
            v = (v | 0) > 16 ? 16 : v;
            q = d;
            while (1) {
                c[u + 0 >> 2] = 0;
                c[u + 4 >> 2] = 0;
                c[u + 8 >> 2] = 0;
                c[u + 12 >> 2] = 0;
                c[u + 16 >> 2] = 0;
                c[u + 20 >> 2] = 0;
                c[u + 24 >> 2] = 0;
                c[u + 28 >> 2] = 0;
                A = (v | 0) > 1;
                z = 0;
                do {
                    if (A) {
                        y = u + (z << 2) | 0;
                        w = c[y >> 2] | 0;
                        x = 1;
                        do {
                            w = ($(b[q + (x << 4 << 1) >> 1] | 0, a[1752 + (x << 1 << 5) + z >> 0] | 0) | 0) + w | 0;
                            x = x + 2 | 0
                        } while ((x | 0) < (v | 0));
                        c[y >> 2] = w
                    }
                    z = z + 1 | 0
                } while ((z | 0) != 8);
                c[l + 0 >> 2] = 0;
                c[l + 4 >> 2] = 0;
                c[l + 8 >> 2] = 0;
                c[l + 12 >> 2] = 0;
                z = 0;
                do {
                    x = l + (z << 2) | 0;
                    w = c[x >> 2] | 0;
                    y = 1;
                    do {
                        w = ($(b[q + (y << 5 << 1) >> 1] | 0, a[1752 + (y << 2 << 5) + z >> 0] | 0) | 0) + w | 0;
                        y = y + 2 | 0
                    } while ((y | 0) < 8);
                    c[x >> 2] = w;
                    z = z + 1 | 0
                } while ((z | 0) != 4);
                z = b[q >> 1] << 6;
                y = b[q + 256 >> 1] << 6;
                A = y + z | 0;
                y = z - y | 0;
                z = b[q + 128 >> 1] | 0;
                w = b[q + 384 >> 1] | 0;
                x = (w * 36 | 0) + (z * 83 | 0) | 0;
                z = ($(w, -83) | 0) + (z * 36 | 0) | 0;
                w = x + A | 0;
                c[m >> 2] = w;
                c[n >> 2] = z + y;
                c[o >> 2] = y - z;
                c[p >> 2] = A - x;
                x = 0;
                while (1) {
                    A = c[l + (x << 2) >> 2] | 0;
                    c[t + (x << 2) >> 2] = A + w;
                    c[t + (7 - x << 2) >> 2] = w - A;
                    x = x + 1 | 0;
                    if ((x | 0) == 4) {
                        w = 0;
                        break
                    }
                    w = c[m + (x << 2) >> 2] | 0
                }
                do {
                    x = c[t + (w << 2) >> 2] | 0;
                    y = c[u + (w << 2) >> 2] | 0;
                    A = x + 64 + y | 0;
                    z = A >> 7;
                    if ((z + 32768 | 0) >>> 0 > 65535) z = A >> 31 ^ 32767;
                    b[q + (w << 4 << 1) >> 1] = z;
                    x = x - y + 64 | 0;
                    y = x >> 7;
                    if ((y + 32768 | 0) >>> 0 > 65535) y = x >> 31 ^ 32767;
                    b[q + (15 - w << 4 << 1) >> 1] = y;
                    w = w + 1 | 0
                } while ((w | 0) != 8);
                if ((v | 0) < 16) v = (r & 3 | 0) == 0 & (r | 0) != 0 ? v + -4 | 0 : v;
                r = r + 1 | 0;
                if ((r | 0) == 16) break;
                else q = q + 2 | 0
            }
            o = s ? 16 : e;
            p = (o | 0) > 1;
            l = f + 4 | 0;
            m = f + 8 | 0;
            n = f + 12 | 0;
            q = 0;
            while (1) {
                c[h + 0 >> 2] = 0;
                c[h + 4 >> 2] = 0;
                c[h + 8 >> 2] = 0;
                c[h + 12 >> 2] = 0;
                c[h + 16 >> 2] = 0;
                c[h + 20 >> 2] = 0;
                c[h + 24 >> 2] = 0;
                c[h + 28 >> 2] = 0;
                r = 0;
                do {
                    if (p) {
                        e = h + (r << 2) | 0;
                        t = c[e >> 2] | 0;
                        s = 1;
                        do {
                            t = ($(b[d + (s << 1) >> 1] | 0, a[1752 + (s << 1 << 5) + r >> 0] | 0) | 0) + t | 0;
                            s = s + 2 | 0
                        } while ((s | 0) < (o | 0));
                        c[e >> 2] = t
                    }
                    r = r + 1 | 0
                } while ((r | 0) != 8);
                c[k + 0 >> 2] = 0;
                c[k + 4 >> 2] = 0;
                c[k + 8 >> 2] = 0;
                c[k + 12 >> 2] = 0;
                t = 0;
                do {
                    r = k + (t << 2) | 0;
                    s = c[r >> 2] | 0;
                    e = 1;
                    do {
                        s = ($(b[d + (e << 1 << 1) >> 1] | 0, a[1752 + (e << 2 << 5) + t >> 0] | 0) | 0) + s | 0;
                        e = e + 2 | 0
                    } while ((e | 0) < 8);
                    c[r >> 2] = s;
                    t = t + 1 | 0
                } while ((t | 0) != 4);
                z = b[d >> 1] << 6;
                y = b[d + 16 >> 1] << 6;
                A = y + z | 0;
                y = z - y | 0;
                z = b[d + 8 >> 1] | 0;
                r = b[d + 24 >> 1] | 0;
                e = (r * 36 | 0) + (z * 83 | 0) | 0;
                z = ($(r, -83) | 0) + (z * 36 | 0) | 0;
                r = e + A | 0;
                c[f >> 2] = r;
                c[l >> 2] = z + y;
                c[m >> 2] = y - z;
                c[n >> 2] = A - e;
                e = 0;
                while (1) {
                    A = c[k + (e << 2) >> 2] | 0;
                    c[g + (e << 2) >> 2] = A + r;
                    c[g + (7 - e << 2) >> 2] = r - A;
                    e = e + 1 | 0;
                    if ((e | 0) == 4) {
                        r = 0;
                        break
                    }
                    r = c[f + (e << 2) >> 2] | 0
                }
                do {
                    e = c[g + (r << 2) >> 2] | 0;
                    s = c[h + (r << 2) >> 2] | 0;
                    u = e + 2048 + s | 0;
                    t = u >> 12;
                    if ((t + 32768 | 0) >>> 0 > 65535) t = u >> 31 ^ 32767;
                    b[d + (r << 1) >> 1] = t;
                    e = e - s + 2048 | 0;
                    s = e >> 12;
                    if ((s + 32768 | 0) >>> 0 > 65535) s = e >> 31 ^ 32767;
                    b[d + (15 - r << 1) >> 1] = s;
                    r = r + 1 | 0
                } while ((r | 0) != 8);
                q = q + 1 | 0;
                if ((q | 0) == 16) break;
                else d = d + 32 | 0
            }
            i = j;
            return
        }

        function Pc(d, e) {
            d = d | 0;
            e = e | 0;
            var f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                D = 0;
            m = i;
            i = i + 320 | 0;
            g = m + 256 | 0;
            l = m + 192 | 0;
            o = m + 160 | 0;
            s = m + 128 | 0;
            u = m + 112 | 0;
            t = m + 96 | 0;
            f = m + 64 | 0;
            j = m + 32 | 0;
            h = m + 16 | 0;
            k = m;
            q = (e | 0) > 32;
            x = e + 4 | 0;
            v = u + 4 | 0;
            w = u + 8 | 0;
            n = u + 12 | 0;
            p = 0;
            x = (x | 0) > 32 ? 32 : x;
            r = d;
            while (1) {
                y = l + 0 | 0;
                z = y + 64 | 0;
                do {
                    c[y >> 2] = 0;
                    y = y + 4 | 0
                } while ((y | 0) < (z | 0));
                B = (x | 0) > 1;
                A = 0;
                do {
                    if (B) {
                        z = l + (A << 2) | 0;
                        y = c[z >> 2] | 0;
                        C = 1;
                        do {
                            y = ($(b[r + (C << 5 << 1) >> 1] | 0, a[1752 + (C << 5) + A >> 0] | 0) | 0) + y | 0;
                            C = C + 2 | 0
                        } while ((C | 0) < (x | 0));
                        c[z >> 2] = y
                    }
                    A = A + 1 | 0
                } while ((A | 0) != 16);
                c[s + 0 >> 2] = 0;
                c[s + 4 >> 2] = 0;
                c[s + 8 >> 2] = 0;
                c[s + 12 >> 2] = 0;
                c[s + 16 >> 2] = 0;
                c[s + 20 >> 2] = 0;
                c[s + 24 >> 2] = 0;
                c[s + 28 >> 2] = 0;
                y = (x | 0) / 2 | 0;
                z = (x | 0) > 3;
                A = 0;
                do {
                    if (z) {
                        D = s + (A << 2) | 0;
                        B = c[D >> 2] | 0;
                        C = 1;
                        do {
                            B = ($(b[r + (C << 6 << 1) >> 1] | 0, a[1752 + (C << 1 << 5) + A >> 0] | 0) | 0) + B | 0;
                            C = C + 2 | 0
                        } while ((C | 0) < (y | 0));
                        c[D >> 2] = B
                    }
                    A = A + 1 | 0
                } while ((A | 0) != 8);
                c[t + 0 >> 2] = 0;
                c[t + 4 >> 2] = 0;
                c[t + 8 >> 2] = 0;
                c[t + 12 >> 2] = 0;
                A = 0;
                do {
                    B = t + (A << 2) | 0;
                    z = c[B >> 2] | 0;
                    y = 1;
                    do {
                        z = ($(b[r + (y << 7 << 1) >> 1] | 0, a[1752 + (y << 2 << 5) + A >> 0] | 0) | 0) + z | 0;
                        y = y + 2 | 0
                    } while ((y | 0) < 8);
                    c[B >> 2] = z;
                    A = A + 1 | 0
                } while ((A | 0) != 4);
                C = b[r >> 1] << 6;
                B = b[r + 1024 >> 1] << 6;
                D = B + C | 0;
                B = C - B | 0;
                C = b[r + 512 >> 1] | 0;
                y = b[r + 1536 >> 1] | 0;
                z = (y * 36 | 0) + (C * 83 | 0) | 0;
                C = ($(y, -83) | 0) + (C * 36 | 0) | 0;
                y = z + D | 0;
                c[u >> 2] = y;
                c[v >> 2] = C + B;
                c[w >> 2] = B - C;
                c[n >> 2] = D - z;
                z = 0;
                while (1) {
                    D = c[t + (z << 2) >> 2] | 0;
                    c[o + (z << 2) >> 2] = D + y;
                    c[o + (7 - z << 2) >> 2] = y - D;
                    z = z + 1 | 0;
                    if ((z | 0) == 4) {
                        y = 0;
                        break
                    }
                    y = c[u + (z << 2) >> 2] | 0
                }
                do {
                    C = c[o + (y << 2) >> 2] | 0;
                    D = c[s + (y << 2) >> 2] | 0;
                    c[g + (y << 2) >> 2] = D + C;
                    c[g + (15 - y << 2) >> 2] = C - D;
                    y = y + 1 | 0
                } while ((y | 0) != 8);
                y = 0;
                do {
                    z = c[g + (y << 2) >> 2] | 0;
                    A = c[l + (y << 2) >> 2] | 0;
                    B = z + 64 + A | 0;
                    C = B >> 7;
                    if ((C + 32768 | 0) >>> 0 > 65535) C = B >> 31 ^ 32767;
                    b[r + (y << 5 << 1) >> 1] = C;
                    z = z - A + 64 | 0;
                    A = z >> 7;
                    if ((A + 32768 | 0) >>> 0 > 65535) A = z >> 31 ^ 32767;
                    b[r + (31 - y << 5 << 1) >> 1] = A;
                    y = y + 1 | 0
                } while ((y | 0) != 16);
                if ((x | 0) < 32) x = (p & 3 | 0) == 0 & (p | 0) != 0 ? x + -4 | 0 : x;
                p = p + 1 | 0;
                if ((p | 0) == 32) break;
                else r = r + 2 | 0
            }
            p = q ? 32 : e;
            o = (p | 0) > 1;
            n = (p | 0) / 2 | 0;
            q = (p | 0) > 3;
            s = h + 4 | 0;
            r = h + 8 | 0;
            e = h + 12 | 0;
            t = 0;
            while (1) {
                y = l + 0 | 0;
                z = y + 64 | 0;
                do {
                    c[y >> 2] = 0;
                    y = y + 4 | 0
                } while ((y | 0) < (z | 0));
                v = 0;
                do {
                    if (o) {
                        w = l + (v << 2) | 0;
                        u = c[w >> 2] | 0;
                        x = 1;
                        do {
                            u = ($(b[d + (x << 1) >> 1] | 0, a[1752 + (x << 5) + v >> 0] | 0) | 0) + u | 0;
                            x = x + 2 | 0
                        } while ((x | 0) < (p | 0));
                        c[w >> 2] = u
                    }
                    v = v + 1 | 0
                } while ((v | 0) != 16);
                c[j + 0 >> 2] = 0;
                c[j + 4 >> 2] = 0;
                c[j + 8 >> 2] = 0;
                c[j + 12 >> 2] = 0;
                c[j + 16 >> 2] = 0;
                c[j + 20 >> 2] = 0;
                c[j + 24 >> 2] = 0;
                c[j + 28 >> 2] = 0;
                x = 0;
                do {
                    if (q) {
                        u = j + (x << 2) | 0;
                        w = c[u >> 2] | 0;
                        v = 1;
                        do {
                            D = v << 1;
                            w = ($(b[d + (D << 1) >> 1] | 0, a[1752 + (D << 5) + x >> 0] | 0) | 0) + w | 0;
                            v = v + 2 | 0
                        } while ((v | 0) < (n | 0));
                        c[u >> 2] = w
                    }
                    x = x + 1 | 0
                } while ((x | 0) != 8);
                c[k + 0 >> 2] = 0;
                c[k + 4 >> 2] = 0;
                c[k + 8 >> 2] = 0;
                c[k + 12 >> 2] = 0;
                u = 0;
                do {
                    v = k + (u << 2) | 0;
                    x = c[v >> 2] | 0;
                    w = 1;
                    do {
                        D = w << 2;
                        x = ($(b[d + (D << 1) >> 1] | 0, a[1752 + (D << 5) + u >> 0] | 0) | 0) + x | 0;
                        w = w + 2 | 0
                    } while ((w | 0) < 8);
                    c[v >> 2] = x;
                    u = u + 1 | 0
                } while ((u | 0) != 4);
                C = b[d >> 1] << 6;
                B = b[d + 32 >> 1] << 6;
                D = B + C | 0;
                B = C - B | 0;
                C = b[d + 16 >> 1] | 0;
                u = b[d + 48 >> 1] | 0;
                v = (u * 36 | 0) + (C * 83 | 0) | 0;
                C = ($(u, -83) | 0) + (C * 36 | 0) | 0;
                u = v + D | 0;
                c[h >> 2] = u;
                c[s >> 2] = C + B;
                c[r >> 2] = B - C;
                c[e >> 2] = D - v;
                v = 0;
                while (1) {
                    D = c[k + (v << 2) >> 2] | 0;
                    c[f + (v << 2) >> 2] = D + u;
                    c[f + (7 - v << 2) >> 2] = u - D;
                    v = v + 1 | 0;
                    if ((v | 0) == 4) {
                        u = 0;
                        break
                    }
                    u = c[h + (v << 2) >> 2] | 0
                }
                do {
                    C = c[f + (u << 2) >> 2] | 0;
                    D = c[j + (u << 2) >> 2] | 0;
                    c[g + (u << 2) >> 2] = D + C;
                    c[g + (15 - u << 2) >> 2] = C - D;
                    u = u + 1 | 0
                } while ((u | 0) != 8);
                u = 0;
                do {
                    v = c[g + (u << 2) >> 2] | 0;
                    w = c[l + (u << 2) >> 2] | 0;
                    x = v + 2048 + w | 0;
                    y = x >> 12;
                    if ((y + 32768 | 0) >>> 0 > 65535) y = x >> 31 ^ 32767;
                    b[d + (u << 1) >> 1] = y;
                    v = v - w + 2048 | 0;
                    w = v >> 12;
                    if ((w + 32768 | 0) >>> 0 > 65535) w = v >> 31 ^ 32767;
                    b[d + (31 - u << 1) >> 1] = w;
                    u = u + 1 | 0
                } while ((u | 0) != 16);
                t = t + 1 | 0;
                if ((t | 0) == 32) break;
                else d = d + 64 | 0
            }
            i = m;
            return
        }

        function Qc(a) {
            a = a | 0;
            var c = 0,
                d = 0,
                e = 0,
                f = 0;
            c = i;
            d = ((((b[a >> 1] | 0) + 1 | 0) >>> 1) + 32 | 0) >>> 6 & 65535;
            e = 0;
            do {
                f = e << 2;
                b[a + (f << 1) >> 1] = d;
                b[a + ((f | 1) << 1) >> 1] = d;
                b[a + ((f | 2) << 1) >> 1] = d;
                b[a + ((f | 3) << 1) >> 1] = d;
                e = e + 1 | 0
            } while ((e | 0) != 4);
            i = c;
            return
        }

        function Rc(a) {
            a = a | 0;
            var c = 0,
                d = 0,
                e = 0,
                f = 0;
            c = i;
            d = ((((b[a >> 1] | 0) + 1 | 0) >>> 1) + 32 | 0) >>> 6 & 65535;
            e = 0;
            do {
                f = e << 3;
                b[a + (f << 1) >> 1] = d;
                b[a + ((f | 1) << 1) >> 1] = d;
                b[a + ((f | 2) << 1) >> 1] = d;
                b[a + ((f | 3) << 1) >> 1] = d;
                b[a + ((f | 4) << 1) >> 1] = d;
                b[a + ((f | 5) << 1) >> 1] = d;
                b[a + ((f | 6) << 1) >> 1] = d;
                b[a + ((f | 7) << 1) >> 1] = d;
                e = e + 1 | 0
            } while ((e | 0) != 8);
            i = c;
            return
        }

        function Sc(a) {
            a = a | 0;
            var c = 0,
                d = 0,
                e = 0,
                f = 0,
                g = 0;
            c = i;
            e = ((((b[a >> 1] | 0) + 1 | 0) >>> 1) + 32 | 0) >>> 6 & 65535;
            d = 0;
            do {
                f = d << 4;
                g = 0;
                do {
                    b[a + (g + f << 1) >> 1] = e;
                    g = g + 1 | 0
                } while ((g | 0) != 16);
                d = d + 1 | 0
            } while ((d | 0) != 16);
            i = c;
            return
        }

        function Tc(a) {
            a = a | 0;
            var c = 0,
                d = 0,
                e = 0,
                f = 0,
                g = 0;
            c = i;
            e = ((((b[a >> 1] | 0) + 1 | 0) >>> 1) + 32 | 0) >>> 6 & 65535;
            d = 0;
            do {
                f = d << 5;
                g = 0;
                do {
                    b[a + (g + f << 1) >> 1] = e;
                    g = g + 1 | 0
                } while ((g | 0) != 32);
                d = d + 1 | 0
            } while ((d | 0) != 32);
            i = c;
            return
        }

        function Uc(a, b, c, d, e, f, g, h) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            f = i;
            if ((e | 0) > 0) g = 0;
            else {
                i = f;
                return
            }
            while (1) {
                mf(a | 0, c | 0, h | 0) | 0;
                g = g + 1 | 0;
                if ((g | 0) == (e | 0)) break;
                else {
                    a = a + b | 0;
                    c = c + d | 0
                }
            }
            i = f;
            return
        }

        function Vc(b, c, e, f, g, h, j, k) {
            b = b | 0;
            c = c | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            var l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                D = 0,
                E = 0,
                F = 0,
                G = 0,
                H = 0,
                I = 0,
                J = 0,
                K = 0;
            j = i;
            s = h + -1 | 0;
            l = 2840 + (s << 4) | 0;
            if ((g | 0) <= 0) {
                i = j;
                return
            }
            h = (k | 0) > 0;
            p = 2841 + (s << 4) | 0;
            q = 2842 + (s << 4) | 0;
            r = 2843 + (s << 4) | 0;
            o = 2844 + (s << 4) | 0;
            n = 2845 + (s << 4) | 0;
            m = 2846 + (s << 4) | 0;
            s = 2847 + (s << 4) | 0;
            w = 0;
            while (1) {
                if (h) {
                    t = a[l >> 0] | 0;
                    y = a[p >> 0] | 0;
                    v = a[q >> 0] | 0;
                    A = a[r >> 0] | 0;
                    B = a[o >> 0] | 0;
                    C = a[n >> 0] | 0;
                    D = a[m >> 0] | 0;
                    z = a[s >> 0] | 0;
                    u = 0;
                    do {
                        K = $(d[e + (u + -3) >> 0] | 0, t) | 0;
                        J = $(d[e + (u + -2) >> 0] | 0, y) | 0;
                        I = $(d[e + (u + -1) >> 0] | 0, v) | 0;
                        H = $(d[e + u >> 0] | 0, A) | 0;
                        x = u;
                        u = u + 1 | 0;
                        G = $(d[e + u >> 0] | 0, B) | 0;
                        F = $(d[e + (x + 2) >> 0] | 0, C) | 0;
                        E = $(d[e + (x + 3) >> 0] | 0, D) | 0;
                        E = K + 32 + J + I + H + G + F + E + ($(d[e + (x + 4) >> 0] | 0, z) | 0) >> 6;
                        if (E >>> 0 > 255) E = 0 - E >> 31;
                        a[b + x >> 0] = E
                    } while ((u | 0) != (k | 0))
                }
                w = w + 1 | 0;
                if ((w | 0) == (g | 0)) break;
                else {
                    b = b + c | 0;
                    e = e + f | 0
                }
            }
            i = j;
            return
        }

        function Wc(b, c, e, f, g, h, j, k) {
            b = b | 0;
            c = c | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            var l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                D = 0,
                E = 0,
                F = 0,
                G = 0,
                H = 0,
                I = 0,
                J = 0,
                K = 0,
                L = 0,
                M = 0;
            h = i;
            u = j + -1 | 0;
            j = 2840 + (u << 4) | 0;
            if ((g | 0) <= 0) {
                i = h;
                return
            }
            l = (k | 0) > 0;
            q = f * 3 | 0;
            t = 2841 + (u << 4) | 0;
            r = f << 1;
            s = 2842 + (u << 4) | 0;
            p = 2843 + (u << 4) | 0;
            o = 2844 + (u << 4) | 0;
            n = 2845 + (u << 4) | 0;
            m = 2846 + (u << 4) | 0;
            v = 2847 + (u << 4) | 0;
            u = f << 2;
            B = 0;
            while (1) {
                if (l) {
                    y = a[j >> 0] | 0;
                    D = a[t >> 0] | 0;
                    E = a[s >> 0] | 0;
                    F = a[p >> 0] | 0;
                    C = a[o >> 0] | 0;
                    z = a[n >> 0] | 0;
                    x = a[m >> 0] | 0;
                    w = a[v >> 0] | 0;
                    A = 0;
                    do {
                        M = $(d[e + (A - q) >> 0] | 0, y) | 0;
                        L = $(d[e + (A - r) >> 0] | 0, D) | 0;
                        K = $(d[e + (A - f) >> 0] | 0, E) | 0;
                        J = $(d[e + A >> 0] | 0, F) | 0;
                        I = $(d[e + (A + f) >> 0] | 0, C) | 0;
                        H = $(d[e + (A + r) >> 0] | 0, z) | 0;
                        G = $(d[e + (A + q) >> 0] | 0, x) | 0;
                        G = M + 32 + L + K + J + I + H + G + ($(d[e + (A + u) >> 0] | 0, w) | 0) >> 6;
                        if (G >>> 0 > 255) G = 0 - G >> 31;
                        a[b + A >> 0] = G;
                        A = A + 1 | 0
                    } while ((A | 0) != (k | 0))
                }
                B = B + 1 | 0;
                if ((B | 0) == (g | 0)) break;
                else {
                    b = b + c | 0;
                    e = e + f | 0
                }
            }
            i = h;
            return
        }

        function Xc(c, d, e, f, g, h, j, k) {
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            var l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                D = 0,
                E = 0,
                F = 0,
                G = 0,
                H = 0,
                I = 0,
                J = 0,
                K = 0,
                L = 0,
                M = 0,
                N = 0,
                O = 0,
                P = 0,
                Q = 0,
                R = 0,
                S = 0;
            l = i;
            i = i + 9088 | 0;
            m = l;
            v = h + -1 | 0;
            n = 2840 + (v << 4) | 0;
            h = g + 7 | 0;
            if ((h | 0) > 0) {
                t = (k | 0) > 0;
                p = 2841 + (v << 4) | 0;
                o = 2842 + (v << 4) | 0;
                u = 2843 + (v << 4) | 0;
                q = 2844 + (v << 4) | 0;
                r = 2845 + (v << 4) | 0;
                s = 2846 + (v << 4) | 0;
                v = 2847 + (v << 4) | 0;
                y = e + ($(f, -3) | 0) | 0;
                z = m;
                A = 0;
                while (1) {
                    if (t) {
                        E = a[n >> 0] | 0;
                        D = a[p >> 0] | 0;
                        F = a[o >> 0] | 0;
                        G = a[u >> 0] | 0;
                        H = a[q >> 0] | 0;
                        I = a[r >> 0] | 0;
                        e = a[s >> 0] | 0;
                        K = a[v >> 0] | 0;
                        w = a[y + -2 >> 0] | 0;
                        x = a[y + -1 >> 0] | 0;
                        B = a[y >> 0] | 0;
                        C = a[y + 1 >> 0] | 0;
                        M = a[y + 2 >> 0] | 0;
                        L = a[y + 3 >> 0] | 0;
                        N = a[y + -3 >> 0] | 0;
                        J = 0;
                        while (1) {
                            O = ($(w & 255, D) | 0) + ($(N & 255, E) | 0) + ($(x & 255, F) | 0) + ($(B & 255, G) | 0) + ($(C & 255, H) | 0) + ($(M & 255, I) | 0) + ($(L & 255, e) | 0) | 0;
                            N = a[y + (J + 4) >> 0] | 0;
                            b[z + (J << 1) >> 1] = O + ($(N & 255, K) | 0);
                            J = J + 1 | 0;
                            if ((J | 0) == (k | 0)) break;
                            else {
                                S = L;
                                R = M;
                                Q = C;
                                P = B;
                                O = x;
                                L = N;
                                N = w;
                                M = S;
                                C = R;
                                B = Q;
                                x = P;
                                w = O
                            }
                        }
                    }
                    A = A + 1 | 0;
                    if ((A | 0) == (h | 0)) break;
                    else {
                        y = y + f | 0;
                        z = z + 128 | 0
                    }
                }
            }
            s = j + -1 | 0;
            j = 2840 + (s << 4) | 0;
            if ((g | 0) <= 0) {
                i = l;
                return
            }
            f = (k | 0) > 0;
            h = 2841 + (s << 4) | 0;
            n = 2842 + (s << 4) | 0;
            o = 2843 + (s << 4) | 0;
            p = 2844 + (s << 4) | 0;
            q = 2845 + (s << 4) | 0;
            r = 2846 + (s << 4) | 0;
            s = 2847 + (s << 4) | 0;
            u = m + 384 | 0;
            v = 0;
            while (1) {
                if (f) {
                    e = a[j >> 0] | 0;
                    m = a[h >> 0] | 0;
                    x = a[n >> 0] | 0;
                    y = a[o >> 0] | 0;
                    z = a[p >> 0] | 0;
                    A = a[q >> 0] | 0;
                    B = a[r >> 0] | 0;
                    w = a[s >> 0] | 0;
                    t = 0;
                    do {
                        C = $(b[u + (t + -192 << 1) >> 1] | 0, e) | 0;
                        C = ($(b[u + (t + -128 << 1) >> 1] | 0, m) | 0) + C | 0;
                        C = C + ($(b[u + (t + -64 << 1) >> 1] | 0, x) | 0) | 0;
                        C = C + ($(b[u + (t << 1) >> 1] | 0, y) | 0) | 0;
                        C = C + ($(b[u + (t + 64 << 1) >> 1] | 0, z) | 0) | 0;
                        C = C + ($(b[u + (t + 128 << 1) >> 1] | 0, A) | 0) | 0;
                        C = C + ($(b[u + (t + 192 << 1) >> 1] | 0, B) | 0) | 0;
                        C = (C + ($(b[u + (t + 256 << 1) >> 1] | 0, w) | 0) >> 6) + 32 >> 6;
                        if (C >>> 0 > 255) C = 0 - C >> 31;
                        a[c + t >> 0] = C;
                        t = t + 1 | 0
                    } while ((t | 0) != (k | 0))
                }
                v = v + 1 | 0;
                if ((v | 0) == (g | 0)) break;
                else {
                    c = c + d | 0;
                    u = u + 128 | 0
                }
            }
            i = l;
            return
        }

        function Yc(b, c, e, f, g, h, j, k, l, m, n) {
            b = b | 0;
            c = c | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            m = m | 0;
            n = n | 0;
            var o = 0,
                p = 0,
                q = 0,
                r = 0;
            m = i;
            h = h + 6 | 0;
            l = 1 << h >> 1;
            if ((g | 0) <= 0) {
                i = m;
                return
            }
            o = (n | 0) > 0;
            j = j << 6;
            q = 0;
            while (1) {
                if (o) {
                    p = 0;
                    do {
                        r = (($(j, d[e + p >> 0] | 0) | 0) + l >> h) + k | 0;
                        if (r >>> 0 > 255) r = 0 - r >> 31;
                        a[b + p >> 0] = r;
                        p = p + 1 | 0
                    } while ((p | 0) != (n | 0))
                }
                q = q + 1 | 0;
                if ((q | 0) == (g | 0)) break;
                else {
                    b = b + c | 0;
                    e = e + f | 0
                }
            }
            i = m;
            return
        }

        function Zc(b, c, e, f, g, h, j, k, l, m, n) {
            b = b | 0;
            c = c | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            m = m | 0;
            n = n | 0;
            var o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                D = 0,
                E = 0,
                F = 0,
                G = 0,
                H = 0,
                I = 0;
            m = i;
            w = l + -1 | 0;
            l = 2840 + (w << 4) | 0;
            s = h + 6 | 0;
            p = 1 << s >> 1;
            if ((g | 0) <= 0) {
                i = m;
                return
            }
            o = (n | 0) > 0;
            v = 2841 + (w << 4) | 0;
            u = 2842 + (w << 4) | 0;
            t = 2843 + (w << 4) | 0;
            h = 2844 + (w << 4) | 0;
            r = 2845 + (w << 4) | 0;
            q = 2846 + (w << 4) | 0;
            w = 2847 + (w << 4) | 0;
            x = 0;
            while (1) {
                if (o) {
                    C = a[l >> 0] | 0;
                    y = a[v >> 0] | 0;
                    E = a[u >> 0] | 0;
                    F = a[t >> 0] | 0;
                    G = a[h >> 0] | 0;
                    H = a[r >> 0] | 0;
                    D = a[q >> 0] | 0;
                    z = a[w >> 0] | 0;
                    A = 0;
                    do {
                        I = $(d[e + (A + -3) >> 0] | 0, C) | 0;
                        I = ($(d[e + (A + -2) >> 0] | 0, y) | 0) + I | 0;
                        I = I + ($(d[e + (A + -1) >> 0] | 0, E) | 0) | 0;
                        I = I + ($(d[e + A >> 0] | 0, F) | 0) | 0;
                        B = A;
                        A = A + 1 | 0;
                        I = I + ($(d[e + A >> 0] | 0, G) | 0) | 0;
                        I = I + ($(d[e + (B + 2) >> 0] | 0, H) | 0) | 0;
                        I = I + ($(d[e + (B + 3) >> 0] | 0, D) | 0) | 0;
                        I = (($(I + ($(d[e + (B + 4) >> 0] | 0, z) | 0) | 0, j) | 0) + p >> s) + k | 0;
                        if (I >>> 0 > 255) I = 0 - I >> 31;
                        a[b + B >> 0] = I
                    } while ((A | 0) != (n | 0))
                }
                x = x + 1 | 0;
                if ((x | 0) == (g | 0)) break;
                else {
                    b = b + c | 0;
                    e = e + f | 0
                }
            }
            i = m;
            return
        }

        function _c(b, c, e, f, g, h, j, k, l, m, n) {
            b = b | 0;
            c = c | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            m = m | 0;
            n = n | 0;
            var o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                D = 0,
                E = 0,
                F = 0,
                G = 0,
                H = 0,
                I = 0,
                J = 0,
                K = 0;
            l = i;
            y = m + -1 | 0;
            m = 2840 + (y << 4) | 0;
            u = h + 6 | 0;
            p = 1 << u >> 1;
            if ((g | 0) <= 0) {
                i = l;
                return
            }
            o = (n | 0) > 0;
            v = f * 3 | 0;
            x = 2841 + (y << 4) | 0;
            w = f << 1;
            h = 2842 + (y << 4) | 0;
            t = 2843 + (y << 4) | 0;
            s = 2844 + (y << 4) | 0;
            r = 2845 + (y << 4) | 0;
            q = 2846 + (y << 4) | 0;
            z = 2847 + (y << 4) | 0;
            y = f << 2;
            G = 0;
            while (1) {
                if (o) {
                    D = a[m >> 0] | 0;
                    I = a[x >> 0] | 0;
                    J = a[h >> 0] | 0;
                    H = a[t >> 0] | 0;
                    E = a[s >> 0] | 0;
                    C = a[r >> 0] | 0;
                    B = a[q >> 0] | 0;
                    A = a[z >> 0] | 0;
                    F = 0;
                    do {
                        K = $(d[e + (F - v) >> 0] | 0, D) | 0;
                        K = ($(d[e + (F - w) >> 0] | 0, I) | 0) + K | 0;
                        K = K + ($(d[e + (F - f) >> 0] | 0, J) | 0) | 0;
                        K = K + ($(d[e + F >> 0] | 0, H) | 0) | 0;
                        K = K + ($(d[e + (F + f) >> 0] | 0, E) | 0) | 0;
                        K = K + ($(d[e + (F + w) >> 0] | 0, C) | 0) | 0;
                        K = K + ($(d[e + (F + v) >> 0] | 0, B) | 0) | 0;
                        K = (($(K + ($(d[e + (F + y) >> 0] | 0, A) | 0) | 0, j) | 0) + p >> u) + k | 0;
                        if (K >>> 0 > 255) K = 0 - K >> 31;
                        a[b + F >> 0] = K;
                        F = F + 1 | 0
                    } while ((F | 0) != (n | 0))
                }
                G = G + 1 | 0;
                if ((G | 0) == (g | 0)) break;
                else {
                    b = b + c | 0;
                    e = e + f | 0
                }
            }
            i = l;
            return
        }

        function $c(c, d, e, f, g, h, j, k, l, m, n) {
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            m = m | 0;
            n = n | 0;
            var o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                D = 0,
                E = 0,
                F = 0,
                G = 0,
                H = 0,
                I = 0,
                J = 0,
                K = 0,
                L = 0,
                M = 0,
                N = 0,
                O = 0,
                P = 0,
                Q = 0,
                R = 0,
                S = 0,
                T = 0,
                U = 0,
                V = 0,
                W = 0;
            o = i;
            i = i + 9088 | 0;
            q = o;
            p = h + 6 | 0;
            h = 1 << p >> 1;
            z = l + -1 | 0;
            l = 2840 + (z << 4) | 0;
            s = g + 7 | 0;
            if ((s | 0) > 0) {
                x = (n | 0) > 0;
                r = 2841 + (z << 4) | 0;
                y = 2842 + (z << 4) | 0;
                t = 2843 + (z << 4) | 0;
                u = 2844 + (z << 4) | 0;
                v = 2845 + (z << 4) | 0;
                w = 2846 + (z << 4) | 0;
                z = 2847 + (z << 4) | 0;
                D = e + ($(f, -3) | 0) | 0;
                E = q;
                F = 0;
                while (1) {
                    if (x) {
                        J = a[l >> 0] | 0;
                        I = a[r >> 0] | 0;
                        K = a[y >> 0] | 0;
                        L = a[t >> 0] | 0;
                        B = a[u >> 0] | 0;
                        N = a[v >> 0] | 0;
                        O = a[w >> 0] | 0;
                        P = a[z >> 0] | 0;
                        C = a[D + -2 >> 0] | 0;
                        M = a[D + -1 >> 0] | 0;
                        e = a[D >> 0] | 0;
                        G = a[D + 1 >> 0] | 0;
                        H = a[D + 2 >> 0] | 0;
                        Q = a[D + 3 >> 0] | 0;
                        R = a[D + -3 >> 0] | 0;
                        A = 0;
                        while (1) {
                            S = ($(C & 255, I) | 0) + ($(R & 255, J) | 0) + ($(M & 255, K) | 0) + ($(e & 255, L) | 0) + ($(G & 255, B) | 0) + ($(H & 255, N) | 0) + ($(Q & 255, O) | 0) | 0;
                            R = a[D + (A + 4) >> 0] | 0;
                            b[E + (A << 1) >> 1] = S + ($(R & 255, P) | 0);
                            A = A + 1 | 0;
                            if ((A | 0) == (n | 0)) break;
                            else {
                                W = Q;
                                V = H;
                                U = G;
                                T = e;
                                S = M;
                                Q = R;
                                R = C;
                                H = W;
                                G = V;
                                e = U;
                                M = T;
                                C = S
                            }
                        }
                    }
                    F = F + 1 | 0;
                    if ((F | 0) == (s | 0)) break;
                    else {
                        D = D + f | 0;
                        E = E + 128 | 0
                    }
                }
            }
            w = m + -1 | 0;
            r = 2840 + (w << 4) | 0;
            if ((g | 0) <= 0) {
                i = o;
                return
            }
            l = (n | 0) > 0;
            s = 2841 + (w << 4) | 0;
            t = 2842 + (w << 4) | 0;
            u = 2843 + (w << 4) | 0;
            v = 2844 + (w << 4) | 0;
            m = 2845 + (w << 4) | 0;
            f = 2846 + (w << 4) | 0;
            w = 2847 + (w << 4) | 0;
            z = q + 384 | 0;
            q = 0;
            while (1) {
                if (l) {
                    A = a[r >> 0] | 0;
                    B = a[s >> 0] | 0;
                    C = a[t >> 0] | 0;
                    D = a[u >> 0] | 0;
                    E = a[v >> 0] | 0;
                    F = a[m >> 0] | 0;
                    y = a[f >> 0] | 0;
                    x = a[w >> 0] | 0;
                    e = 0;
                    do {
                        G = $(b[z + (e + -192 << 1) >> 1] | 0, A) | 0;
                        G = ($(b[z + (e + -128 << 1) >> 1] | 0, B) | 0) + G | 0;
                        G = G + ($(b[z + (e + -64 << 1) >> 1] | 0, C) | 0) | 0;
                        G = G + ($(b[z + (e << 1) >> 1] | 0, D) | 0) | 0;
                        G = G + ($(b[z + (e + 64 << 1) >> 1] | 0, E) | 0) | 0;
                        G = G + ($(b[z + (e + 128 << 1) >> 1] | 0, F) | 0) | 0;
                        G = G + ($(b[z + (e + 192 << 1) >> 1] | 0, y) | 0) | 0;
                        G = (($(G + ($(b[z + (e + 256 << 1) >> 1] | 0, x) | 0) >> 6, j) | 0) + h >> p) + k | 0;
                        if (G >>> 0 > 255) G = 0 - G >> 31;
                        a[c + e >> 0] = G;
                        e = e + 1 | 0
                    } while ((e | 0) != (n | 0))
                }
                q = q + 1 | 0;
                if ((q | 0) == (g | 0)) break;
                else {
                    c = c + d | 0;
                    z = z + 128 | 0
                }
            }
            i = o;
            return
        }

        function ad(b, c, e, f, g, h, j, k) {
            b = b | 0;
            c = c | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            var l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0;
            j = i;
            o = h + -1 | 0;
            h = 2808 + (o << 2) | 0;
            if ((g | 0) <= 0) {
                i = j;
                return
            }
            l = (k | 0) > 0;
            n = 2809 + (o << 2) | 0;
            m = 2810 + (o << 2) | 0;
            o = 2811 + (o << 2) | 0;
            s = 0;
            while (1) {
                if (l) {
                    p = a[h >> 0] | 0;
                    u = a[n >> 0] | 0;
                    v = a[m >> 0] | 0;
                    t = a[o >> 0] | 0;
                    r = 0;
                    do {
                        y = $(d[e + (r + -1) >> 0] | 0, p) | 0;
                        x = $(d[e + r >> 0] | 0, u) | 0;
                        q = r;
                        r = r + 1 | 0;
                        w = $(d[e + r >> 0] | 0, v) | 0;
                        w = y + 32 + x + w + ($(d[e + (q + 2) >> 0] | 0, t) | 0) >> 6;
                        if (w >>> 0 > 255) w = 0 - w >> 31;
                        a[b + q >> 0] = w
                    } while ((r | 0) != (k | 0))
                }
                s = s + 1 | 0;
                if ((s | 0) == (g | 0)) break;
                else {
                    b = b + c | 0;
                    e = e + f | 0
                }
            }
            i = j;
            return
        }

        function bd(b, c, e, f, g, h, j, k) {
            b = b | 0;
            c = c | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            var l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0;
            h = i;
            o = j + -1 | 0;
            j = 2808 + (o << 2) | 0;
            if ((g | 0) <= 0) {
                i = h;
                return
            }
            l = (k | 0) > 0;
            n = 2809 + (o << 2) | 0;
            m = 2810 + (o << 2) | 0;
            p = 2811 + (o << 2) | 0;
            o = f << 1;
            t = 0;
            while (1) {
                if (l) {
                    u = a[j >> 0] | 0;
                    v = a[n >> 0] | 0;
                    s = a[m >> 0] | 0;
                    r = a[p >> 0] | 0;
                    q = 0;
                    do {
                        y = $(d[e + (q - f) >> 0] | 0, u) | 0;
                        x = $(d[e + q >> 0] | 0, v) | 0;
                        w = $(d[e + (q + f) >> 0] | 0, s) | 0;
                        w = y + 32 + x + w + ($(d[e + (q + o) >> 0] | 0, r) | 0) >> 6;
                        if (w >>> 0 > 255) w = 0 - w >> 31;
                        a[b + q >> 0] = w;
                        q = q + 1 | 0
                    } while ((q | 0) != (k | 0))
                }
                t = t + 1 | 0;
                if ((t | 0) == (g | 0)) break;
                else {
                    b = b + c | 0;
                    e = e + f | 0
                }
            }
            i = h;
            return
        }

        function cd(c, d, e, f, g, h, j, k) {
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            var l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                D = 0;
            l = i;
            i = i + 8576 | 0;
            m = l;
            r = h + -1 | 0;
            h = 2808 + (r << 2) | 0;
            n = g + 3 | 0;
            if ((n | 0) > 0) {
                q = (k | 0) > 0;
                o = 2809 + (r << 2) | 0;
                p = 2810 + (r << 2) | 0;
                r = 2811 + (r << 2) | 0;
                u = e + (0 - f) | 0;
                v = m;
                w = 0;
                while (1) {
                    if (q) {
                        A = a[h >> 0] | 0;
                        e = a[o >> 0] | 0;
                        y = a[p >> 0] | 0;
                        x = a[r >> 0] | 0;
                        B = a[u + -1 >> 0] | 0;
                        s = a[u >> 0] | 0;
                        t = a[u + 1 >> 0] | 0;
                        z = 0;
                        while (1) {
                            C = ($(s & 255, e) | 0) + ($(B & 255, A) | 0) + ($(t & 255, y) | 0) | 0;
                            B = a[u + (z + 2) >> 0] | 0;
                            b[v + (z << 1) >> 1] = C + ($(B & 255, x) | 0);
                            z = z + 1 | 0;
                            if ((z | 0) == (k | 0)) break;
                            else {
                                D = t;
                                C = s;
                                t = B;
                                s = D;
                                B = C
                            }
                        }
                    }
                    w = w + 1 | 0;
                    if ((w | 0) == (n | 0)) break;
                    else {
                        u = u + f | 0;
                        v = v + 128 | 0
                    }
                }
            }
            o = j + -1 | 0;
            f = 2808 + (o << 2) | 0;
            if ((g | 0) <= 0) {
                i = l;
                return
            }
            j = (k | 0) > 0;
            h = 2809 + (o << 2) | 0;
            n = 2810 + (o << 2) | 0;
            o = 2811 + (o << 2) | 0;
            q = m + 128 | 0;
            r = 0;
            while (1) {
                if (j) {
                    e = a[f >> 0] | 0;
                    s = a[h >> 0] | 0;
                    t = a[n >> 0] | 0;
                    p = a[o >> 0] | 0;
                    m = 0;
                    do {
                        u = $(b[q + (m + -64 << 1) >> 1] | 0, e) | 0;
                        u = ($(b[q + (m << 1) >> 1] | 0, s) | 0) + u | 0;
                        u = u + ($(b[q + (m + 64 << 1) >> 1] | 0, t) | 0) | 0;
                        u = (u + ($(b[q + (m + 128 << 1) >> 1] | 0, p) | 0) >> 6) + 32 >> 6;
                        if (u >>> 0 > 255) u = 0 - u >> 31;
                        a[c + m >> 0] = u;
                        m = m + 1 | 0
                    } while ((m | 0) != (k | 0))
                }
                r = r + 1 | 0;
                if ((r | 0) == (g | 0)) break;
                else {
                    c = c + d | 0;
                    q = q + 128 | 0
                }
            }
            i = l;
            return
        }

        function dd(b, c, e, f, g, h, j, k, l, m, n) {
            b = b | 0;
            c = c | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            m = m | 0;
            n = n | 0;
            var o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0;
            m = i;
            s = l + -1 | 0;
            l = 2808 + (s << 2) | 0;
            h = h + 6 | 0;
            o = 1 << h >> 1;
            if ((g | 0) <= 0) {
                i = m;
                return
            }
            r = (n | 0) > 0;
            p = 2809 + (s << 2) | 0;
            q = 2810 + (s << 2) | 0;
            s = 2811 + (s << 2) | 0;
            x = 0;
            while (1) {
                if (r) {
                    y = a[l >> 0] | 0;
                    t = a[p >> 0] | 0;
                    u = a[q >> 0] | 0;
                    z = a[s >> 0] | 0;
                    w = 0;
                    do {
                        A = $(d[e + (w + -1) >> 0] | 0, y) | 0;
                        A = ($(d[e + w >> 0] | 0, t) | 0) + A | 0;
                        v = w;
                        w = w + 1 | 0;
                        A = A + ($(d[e + w >> 0] | 0, u) | 0) | 0;
                        A = (($(A + ($(d[e + (v + 2) >> 0] | 0, z) | 0) | 0, j) | 0) + o >> h) + k | 0;
                        if (A >>> 0 > 255) A = 0 - A >> 31;
                        a[b + v >> 0] = A
                    } while ((w | 0) != (n | 0))
                }
                x = x + 1 | 0;
                if ((x | 0) == (g | 0)) break;
                else {
                    b = b + c | 0;
                    e = e + f | 0
                }
            }
            i = m;
            return
        }

        function ed(b, c, e, f, g, h, j, k, l, m, n) {
            b = b | 0;
            c = c | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            m = m | 0;
            n = n | 0;
            var o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0;
            l = i;
            s = m + -1 | 0;
            m = 2808 + (s << 2) | 0;
            h = h + 6 | 0;
            o = 1 << h >> 1;
            if ((g | 0) <= 0) {
                i = l;
                return
            }
            p = (n | 0) > 0;
            q = 2809 + (s << 2) | 0;
            r = 2810 + (s << 2) | 0;
            s = 2811 + (s << 2) | 0;
            t = f << 1;
            y = 0;
            while (1) {
                if (p) {
                    x = a[m >> 0] | 0;
                    u = a[q >> 0] | 0;
                    z = a[r >> 0] | 0;
                    w = a[s >> 0] | 0;
                    v = 0;
                    do {
                        A = $(d[e + (v - f) >> 0] | 0, x) | 0;
                        A = ($(d[e + v >> 0] | 0, u) | 0) + A | 0;
                        A = A + ($(d[e + (v + f) >> 0] | 0, z) | 0) | 0;
                        A = (($(A + ($(d[e + (v + t) >> 0] | 0, w) | 0) | 0, j) | 0) + o >> h) + k | 0;
                        if (A >>> 0 > 255) A = 0 - A >> 31;
                        a[b + v >> 0] = A;
                        v = v + 1 | 0
                    } while ((v | 0) != (n | 0))
                }
                y = y + 1 | 0;
                if ((y | 0) == (g | 0)) break;
                else {
                    b = b + c | 0;
                    e = e + f | 0
                }
            }
            i = l;
            return
        }

        function fd(c, d, e, f, g, h, j, k, l, m, n) {
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            m = m | 0;
            n = n | 0;
            var o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                D = 0,
                E = 0,
                F = 0,
                G = 0,
                H = 0;
            o = i;
            i = i + 8576 | 0;
            p = o;
            v = l + -1 | 0;
            q = 2808 + (v << 2) | 0;
            h = h + 6 | 0;
            l = 1 << h >> 1;
            t = g + 3 | 0;
            if ((t | 0) > 0) {
                u = (n | 0) > 0;
                s = 2809 + (v << 2) | 0;
                r = 2810 + (v << 2) | 0;
                v = 2811 + (v << 2) | 0;
                A = e + (0 - f) | 0;
                w = p;
                x = 0;
                while (1) {
                    if (u) {
                        B = a[q >> 0] | 0;
                        E = a[s >> 0] | 0;
                        C = a[r >> 0] | 0;
                        D = a[v >> 0] | 0;
                        F = a[A + -1 >> 0] | 0;
                        y = a[A >> 0] | 0;
                        z = a[A + 1 >> 0] | 0;
                        e = 0;
                        while (1) {
                            G = ($(y & 255, E) | 0) + ($(F & 255, B) | 0) + ($(z & 255, C) | 0) | 0;
                            F = a[A + (e + 2) >> 0] | 0;
                            b[w + (e << 1) >> 1] = G + ($(F & 255, D) | 0);
                            e = e + 1 | 0;
                            if ((e | 0) == (n | 0)) break;
                            else {
                                H = z;
                                G = y;
                                z = F;
                                y = H;
                                F = G
                            }
                        }
                    }
                    x = x + 1 | 0;
                    if ((x | 0) == (t | 0)) break;
                    else {
                        A = A + f | 0;
                        w = w + 128 | 0
                    }
                }
            }
            s = m + -1 | 0;
            m = 2808 + (s << 2) | 0;
            if ((g | 0) <= 0) {
                i = o;
                return
            }
            r = (n | 0) > 0;
            q = 2809 + (s << 2) | 0;
            f = 2810 + (s << 2) | 0;
            s = 2811 + (s << 2) | 0;
            u = p + 128 | 0;
            p = 0;
            while (1) {
                if (r) {
                    e = a[m >> 0] | 0;
                    w = a[q >> 0] | 0;
                    x = a[f >> 0] | 0;
                    v = a[s >> 0] | 0;
                    t = 0;
                    do {
                        y = $(b[u + (t + -64 << 1) >> 1] | 0, e) | 0;
                        y = ($(b[u + (t << 1) >> 1] | 0, w) | 0) + y | 0;
                        y = y + ($(b[u + (t + 64 << 1) >> 1] | 0, x) | 0) | 0;
                        y = (($(y + ($(b[u + (t + 128 << 1) >> 1] | 0, v) | 0) >> 6, j) | 0) + l >> h) + k | 0;
                        if (y >>> 0 > 255) y = 0 - y >> 31;
                        a[c + t >> 0] = y;
                        t = t + 1 | 0
                    } while ((t | 0) != (n | 0))
                }
                p = p + 1 | 0;
                if ((p | 0) == (g | 0)) break;
                else {
                    c = c + d | 0;
                    u = u + 128 | 0
                }
            }
            i = o;
            return
        }

        function gd(e, f, g, h, j, k, l, m, n) {
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            m = m | 0;
            n = n | 0;
            var o = 0,
                p = 0,
                q = 0;
            o = i;
            i = i + 128 | 0;
            k = o;
            q = k + 0 | 0;
            p = q + 128 | 0;
            do {
                c[q >> 2] = 0;
                q = q + 4 | 0
            } while ((q | 0) < (p | 0));
            q = d[j + n + 96 >> 0] | 0;
            c[k + ((q & 31) << 2) >> 2] = b[j + (n * 10 | 0) + 114 >> 1];
            c[k + ((q + 1 & 31) << 2) >> 2] = b[j + (n * 10 | 0) + 116 >> 1];
            c[k + ((q + 2 & 31) << 2) >> 2] = b[j + (n * 10 | 0) + 118 >> 1];
            c[k + ((q + 3 & 31) << 2) >> 2] = b[j + (n * 10 | 0) + 120 >> 1];
            if ((m | 0) <= 0) {
                i = o;
                return
            }
            n = (l | 0) > 0;
            j = 0;
            while (1) {
                if (n) {
                    p = 0;
                    do {
                        q = d[f + p >> 0] | 0;
                        q = q + (c[k + (q >>> 3 << 2) >> 2] | 0) | 0;
                        if (q >>> 0 > 255) q = 0 - q >> 31;
                        a[e + p >> 0] = q;
                        p = p + 1 | 0
                    } while ((p | 0) != (l | 0))
                }
                j = j + 1 | 0;
                if ((j | 0) == (m | 0)) break;
                else {
                    e = e + g | 0;
                    f = f + h | 0
                }
            }
            i = o;
            return
        }

        function hd(e, f, g, h, j, k, l, m, n, o, p, q) {
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            m = m | 0;
            n = n | 0;
            o = o | 0;
            p = p | 0;
            q = q | 0;
            var r = 0,
                s = 0,
                t = 0,
                u = 0;
            p = i;
            o = j + (n * 10 | 0) + 112 | 0;
            r = c[j + (n << 2) + 100 >> 2] | 0;
            if ((r | 0) != 1) {
                if (c[k >> 2] | 0) {
                    q = b[o >> 1] | 0;
                    if ((m | 0) > 0) {
                        s = 0;
                        do {
                            t = (d[f + ($(s, h) | 0) >> 0] | 0) + q | 0;
                            if (t >>> 0 > 255) t = 0 - t >> 31;
                            a[e + ($(s, g) | 0) >> 0] = t;
                            s = s + 1 | 0
                        } while ((s | 0) != (m | 0));
                        q = 1
                    } else q = 1
                } else q = 0;
                if (c[k + 8 >> 2] | 0) {
                    s = b[o >> 1] | 0;
                    l = l + -1 | 0;
                    if ((m | 0) > 0) {
                        t = 0;
                        do {
                            u = (d[f + (($(t, h) | 0) + l) >> 0] | 0) + s | 0;
                            if (u >>> 0 > 255) u = 0 - u >> 31;
                            a[e + (($(t, g) | 0) + l) >> 0] = u;
                            t = t + 1 | 0
                        } while ((t | 0) != (m | 0))
                    }
                }
                if (!r) {
                    s = m;
                    t = q;
                    u = 0;
                    r = l;
                    pd(e, f, g, h, j, r, s, n, t, u);
                    i = p;
                    return
                }
            } else q = 0;
            if (c[k + 4 >> 2] | 0) {
                r = b[o >> 1] | 0;
                if ((q | 0) < (l | 0)) {
                    s = q;
                    do {
                        t = (d[f + s >> 0] | 0) + r | 0;
                        if (t >>> 0 > 255) t = 0 - t >> 31;
                        a[e + s >> 0] = t;
                        s = s + 1 | 0
                    } while ((s | 0) != (l | 0));
                    r = 1
                } else r = 1
            } else r = 0;
            if (!(c[k + 12 >> 2] | 0)) {
                s = m;
                t = q;
                u = r;
                r = l;
                pd(e, f, g, h, j, r, s, n, t, u);
                i = p;
                return
            }
            k = b[o >> 1] | 0;
            o = m + -1 | 0;
            t = $(o, g) | 0;
            m = $(o, h) | 0;
            if ((q | 0) < (l | 0)) s = q;
            else {
                s = o;
                t = q;
                u = r;
                r = l;
                pd(e, f, g, h, j, r, s, n, t, u);
                i = p;
                return
            }
            do {
                u = (d[f + (s + m) >> 0] | 0) + k | 0;
                if (u >>> 0 > 255) u = 0 - u >> 31;
                a[e + (s + t) >> 0] = u;
                s = s + 1 | 0
            } while ((s | 0) != (l | 0));
            pd(e, f, g, h, j, l, o, n, q, r);
            i = p;
            return
        }

        function id(e, f, g, h, j, k, l, m, n, o, p, q) {
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            m = m | 0;
            n = n | 0;
            o = o | 0;
            p = p | 0;
            q = q | 0;
            var r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                D = 0,
                E = 0,
                F = 0,
                G = 0,
                H = 0,
                I = 0,
                J = 0;
            s = i;
            C = j + (n * 10 | 0) + 112 | 0;
            B = c[j + (n << 2) + 100 >> 2] | 0;
            A = (B | 0) != 1;
            if (A) {
                if (c[k >> 2] | 0) {
                    D = b[C >> 1] | 0;
                    if ((m | 0) > 0) {
                        E = 0;
                        do {
                            G = (d[f + ($(E, h) | 0) >> 0] | 0) + D | 0;
                            if (G >>> 0 > 255) G = 0 - G >> 31;
                            a[e + ($(E, g) | 0) >> 0] = G;
                            E = E + 1 | 0
                        } while ((E | 0) != (m | 0));
                        D = 1
                    } else D = 1
                } else D = 0;
                if (c[k + 8 >> 2] | 0) {
                    E = b[C >> 1] | 0;
                    l = l + -1 | 0;
                    if ((m | 0) > 0) {
                        G = 0;
                        do {
                            H = (d[f + (($(G, h) | 0) + l) >> 0] | 0) + E | 0;
                            if (H >>> 0 > 255) H = 0 - H >> 31;
                            a[e + (($(G, g) | 0) + l) >> 0] = H;
                            G = G + 1 | 0
                        } while ((G | 0) != (m | 0))
                    }
                }
                if (!B) {
                    C = 1;
                    E = 0
                } else F = 13
            } else {
                D = 0;
                F = 13
            }
            if ((F | 0) == 13) {
                if (c[k + 4 >> 2] | 0) {
                    F = b[C >> 1] | 0;
                    if ((D | 0) < (l | 0)) {
                        E = D;
                        do {
                            G = (d[f + E >> 0] | 0) + F | 0;
                            if (G >>> 0 > 255) G = 0 - G >> 31;
                            a[e + E >> 0] = G;
                            E = E + 1 | 0
                        } while ((E | 0) != (l | 0));
                        E = 1
                    } else E = 1
                } else E = 0;
                if (c[k + 12 >> 2] | 0) {
                    C = b[C >> 1] | 0;
                    m = m + -1 | 0;
                    G = $(m, g) | 0;
                    H = $(m, h) | 0;
                    if ((D | 0) < (l | 0)) {
                        F = D;
                        do {
                            I = (d[f + (F + H) >> 0] | 0) + C | 0;
                            if (I >>> 0 > 255) I = 0 - I >> 31;
                            a[e + (F + G) >> 0] = I;
                            F = F + 1 | 0
                        } while ((F | 0) != (l | 0));
                        C = 0
                    } else C = 0
                } else C = 0
            }
            pd(e, f, g, h, j, l, m, n, D, E);
            j = (B | 0) == 2;
            if ((a[q >> 0] | 0) == 0 & j ? (c[k >> 2] | 0) == 0 : 0) n = (c[k + 4 >> 2] | 0) == 0;
            else n = 0;
            H = n & 1;
            n = q + 1 | 0;
            B = (B | 0) == 3;
            if ((a[n >> 0] | 0) == 0 & B ? (c[k + 4 >> 2] | 0) == 0 : 0) F = (c[k + 8 >> 2] | 0) == 0;
            else F = 0;
            J = F & 1;
            F = q + 2 | 0;
            if ((a[F >> 0] | 0) == 0 & j ? (c[k + 8 >> 2] | 0) == 0 : 0) G = (c[k + 12 >> 2] | 0) == 0;
            else G = 0;
            I = G & 1;
            G = q + 3 | 0;
            if ((a[G >> 0] | 0) == 0 & B ? (c[k >> 2] | 0) == 0 : 0) k = (c[k + 12 >> 2] | 0) == 0;
            else k = 0;
            k = k & 1;
            A = A ^ 1;
            if (!((a[o >> 0] | 0) == 0 | A) ? (z = H + E | 0, y = m - k | 0, (z | 0) < (y | 0)) : 0)
                do {
                    a[e + ($(z, g) | 0) >> 0] = a[f + ($(z, h) | 0) >> 0] | 0;
                    z = z + 1 | 0
                } while ((z | 0) != (y | 0));
            if (!((a[o + 1 >> 0] | 0) == 0 | A) ? (x = J + E | 0, w = m - I | 0, (x | 0) < (w | 0)) : 0) {
                o = l + -1 | 0;
                do {
                    a[e + (o + ($(x, g) | 0)) >> 0] = a[f + (o + ($(x, h) | 0)) >> 0] | 0;
                    x = x + 1 | 0
                } while ((x | 0) != (w | 0))
            }
            if (!((a[p >> 0] | 0) == 0 | C) ? (v = H + D | 0, u = l - J | 0, (v | 0) < (u | 0)) : 0)
                do {
                    a[e + v >> 0] = a[f + v >> 0] | 0;
                    v = v + 1 | 0
                } while ((v | 0) != (u | 0));
            if (!((a[p + 1 >> 0] | 0) == 0 | C) ? (t = k + D | 0, r = l - I | 0, (t | 0) < (r | 0)) : 0) {
                u = m + -1 | 0;
                p = $(u, h) | 0;
                u = $(u, g) | 0;
                do {
                    a[e + (t + u) >> 0] = a[f + (t + p) >> 0] | 0;
                    t = t + 1 | 0
                } while ((t | 0) != (r | 0))
            }
            if ((a[q >> 0] | 0) != 0 & j) a[e >> 0] = a[f >> 0] | 0;
            if ((a[n >> 0] | 0) != 0 & B) {
                J = l + -1 | 0;
                a[e + J >> 0] = a[f + J >> 0] | 0
            }
            if ((a[F >> 0] | 0) != 0 & j) {
                J = m + -1 | 0;
                I = l + -1 | 0;
                a[e + (I + ($(J, g) | 0)) >> 0] = a[f + (I + ($(J, h) | 0)) >> 0] | 0
            }
            if (!((a[G >> 0] | 0) != 0 & B)) {
                i = s;
                return
            }
            J = m + -1 | 0;
            a[e + ($(J, g) | 0) >> 0] = a[f + ($(J, h) | 0) >> 0] | 0;
            i = s;
            return
        }

        function jd(a, b, c, d, e, f) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            var g = 0;
            g = i;
            od(a, b, 1, c, d, e, f);
            i = g;
            return
        }

        function kd(a, b, c, d, e, f) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            var g = 0;
            g = i;
            od(a, 1, b, c, d, e, f);
            i = g;
            return
        }

        function ld(a, b, c, d, e) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            var f = 0;
            f = i;
            nd(a, b, 1, c, d, e);
            i = f;
            return
        }

        function md(a, b, c, d, e) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            var f = 0;
            f = i;
            nd(a, 1, b, c, d, e);
            i = f;
            return
        }

        function nd(b, e, f, g, h, j) {
            b = b | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            var k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0;
            m = i;
            l = $(e, -2) | 0;
            k = 0 - e | 0;
            n = 0;
            while (1) {
                p = c[g + (n << 2) >> 2] | 0;
                if ((p | 0) >= 1) {
                    s = 0 - p | 0;
                    r = (a[h + n >> 0] | 0) == 0;
                    q = (a[j + n >> 0] | 0) == 0;
                    o = 0;
                    t = b;
                    while (1) {
                        v = t + k | 0;
                        x = d[v >> 0] | 0;
                        u = d[t >> 0] | 0;
                        w = (d[t + l >> 0] | 0) + 4 - (d[t + e >> 0] | 0) + (u - x << 2) >> 3;
                        if ((w | 0) < (s | 0)) w = s;
                        else w = (w | 0) > (p | 0) ? p : w;
                        if (r) {
                            x = w + x | 0;
                            if (x >>> 0 > 255) x = 0 - x >> 31;
                            a[v >> 0] = x
                        }
                        if (q) {
                            u = u - w | 0;
                            if (u >>> 0 > 255) u = 0 - u >> 31;
                            a[t >> 0] = u
                        }
                        o = o + 1 | 0;
                        if ((o | 0) == 4) break;
                        else t = t + f | 0
                    }
                }
                n = n + 1 | 0;
                if ((n | 0) == 2) break;
                else b = b + (f << 2) | 0
            }
            i = m;
            return
        }

        function od(b, e, f, g, h, j, k) {
            b = b | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            var l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                D = 0,
                E = 0,
                F = 0,
                G = 0,
                H = 0,
                I = 0,
                J = 0,
                K = 0,
                L = 0,
                M = 0,
                N = 0,
                O = 0,
                P = 0,
                Q = 0,
                R = 0,
                S = 0,
                T = 0,
                U = 0,
                V = 0,
                W = 0,
                X = 0,
                Y = 0,
                Z = 0,
                _ = 0,
                aa = 0,
                ba = 0;
            t = i;
            o = $(e, -3) | 0;
            p = $(e, -2) | 0;
            q = 0 - e | 0;
            r = e << 1;
            D = f * 3 | 0;
            B = D + o | 0;
            C = D + p | 0;
            A = D - e | 0;
            E = D + r | 0;
            l = D + e | 0;
            y = g >> 3;
            v = g >> 2;
            n = $(e, -4) | 0;
            s = e * 3 | 0;
            w = D + n | 0;
            x = (f + e | 0) * 3 | 0;
            u = (g >> 1) + g >> 3;
            z = f << 2;
            m = f << 2;
            F = 0;
            do {
                U = a[b + o >> 0] | 0;
                T = a[b + p >> 0] | 0;
                S = a[b + q >> 0] | 0;
                J = S & 255;
                N = (U & 255) - ((T & 255) << 1) + J | 0;
                N = (N | 0) > -1 ? N : 0 - N | 0;
                P = a[b + r >> 0] | 0;
                Q = a[b + e >> 0] | 0;
                R = a[b >> 0] | 0;
                X = R & 255;
                V = (P & 255) - ((Q & 255) << 1) + X | 0;
                V = (V | 0) > -1 ? V : 0 - V | 0;
                _ = d[b + A >> 0] | 0;
                M = (d[b + B >> 0] | 0) - ((d[b + C >> 0] | 0) << 1) + _ | 0;
                M = (M | 0) > -1 ? M : 0 - M | 0;
                Y = d[b + D >> 0] | 0;
                O = (d[b + E >> 0] | 0) - ((d[b + l >> 0] | 0) << 1) + Y | 0;
                O = (O | 0) > -1 ? O : 0 - O | 0;
                H = V + N | 0;
                I = O + M | 0;
                G = c[h + (F << 2) >> 2] | 0;
                W = a[j + F >> 0] | 0;
                L = a[k + F >> 0] | 0;
                do
                    if ((I + H | 0) < (g | 0)) {
                        Z = (G * 5 | 0) + 1 >> 1;
                        aa = (d[b + n >> 0] | 0) - J | 0;
                        K = a[b + s >> 0] | 0;
                        ba = (K & 255) - X | 0;
                        if ((((((((ba | 0) > -1 ? ba : 0 - ba | 0) + ((aa | 0) > -1 ? aa : 0 - aa | 0) | 0) < (y | 0) ? (ba = J - X | 0, (((ba | 0) > -1 ? ba : 0 - ba | 0) | 0) < (Z | 0)) : 0) ? (ba = (d[b + w >> 0] | 0) - _ | 0, aa = (d[b + x >> 0] | 0) - Y | 0, (((aa | 0) > -1 ? aa : 0 - aa | 0) + ((ba | 0) > -1 ? ba : 0 - ba | 0) | 0) < (y | 0)) : 0) ? (ba = _ - Y | 0, (((ba | 0) > -1 ? ba : 0 - ba | 0) | 0) < (Z | 0)) : 0) ? (H << 1 | 0) < (v | 0) : 0) ? (I << 1 | 0) < (v | 0) : 0) {
                            G = G << 1;
                            H = W << 24 >> 24 == 0;
                            I = 0 - G | 0;
                            J = L << 24 >> 24 == 0;
                            Y = K;
                            K = 1;
                            L = b;
                            while (1) {
                                V = L + o | 0;
                                U = U & 255;
                                W = L + p | 0;
                                T = T & 255;
                                X = L + q | 0;
                                N = S & 255;
                                R = R & 255;
                                S = L + e | 0;
                                Q = Q & 255;
                                M = L + r | 0;
                                O = P & 255;
                                P = Y & 255;
                                if (H) {
                                    Y = d[L + n >> 0] | 0;
                                    Z = (U + 4 + Q + (N + T + R << 1) >> 3) - N | 0;
                                    if ((Z | 0) < (I | 0)) Z = I;
                                    else Z = (Z | 0) > (G | 0) ? G : Z;
                                    a[X >> 0] = Z + N;
                                    X = ((U + 2 + T + N + R | 0) >>> 2) - T | 0;
                                    if ((X | 0) < (I | 0)) X = I;
                                    else X = (X | 0) > (G | 0) ? G : X;
                                    a[W >> 0] = X + T;
                                    W = ((U * 3 | 0) + 4 + T + N + R + (Y << 1) >> 3) - U | 0;
                                    if ((W | 0) < (I | 0)) W = I;
                                    else W = (W | 0) > (G | 0) ? G : W;
                                    a[V >> 0] = W + U
                                }
                                if (J) {
                                    T = (T + 4 + O + (R + N + Q << 1) >> 3) - R | 0;
                                    if ((T | 0) < (I | 0)) T = I;
                                    else T = (T | 0) > (G | 0) ? G : T;
                                    a[L >> 0] = T + R;
                                    T = ((N + 2 + R + Q + O | 0) >>> 2) - Q | 0;
                                    if ((T | 0) < (I | 0)) T = I;
                                    else T = (T | 0) > (G | 0) ? G : T;
                                    a[S >> 0] = T + Q;
                                    N = (N + 4 + R + Q + (O * 3 | 0) + (P << 1) >> 3) - O | 0;
                                    if ((N | 0) < (I | 0)) N = I;
                                    else N = (N | 0) > (G | 0) ? G : N;
                                    a[M >> 0] = N + O
                                }
                                M = L + f | 0;
                                if ((K | 0) == 4) break;
                                U = a[L + (o + f) >> 0] | 0;
                                T = a[L + (p + f) >> 0] | 0;
                                S = a[L + (f - e) >> 0] | 0;
                                R = a[M >> 0] | 0;
                                Q = a[L + (f + e) >> 0] | 0;
                                P = a[L + (r + f) >> 0] | 0;
                                Y = a[L + (s + f) >> 0] | 0;
                                K = K + 1 | 0;
                                L = M
                            }
                            b = b + m | 0;
                            break
                        }
                        H = G >> 1;
                        I = G * 10 | 0;
                        J = 0 - G | 0;
                        K = W << 24 >> 24 != 0;
                        L = L << 24 >> 24 != 0;
                        M = (M + N | 0) < (u | 0) & (K ^ 1);
                        N = 0 - H | 0;
                        O = (O + V | 0) < (u | 0) & (L ^ 1);
                        V = T;
                        W = R;
                        Y = Q;
                        Q = 1;
                        R = b;
                        while (1) {
                            X = U & 255;
                            T = R + p | 0;
                            V = V & 255;
                            _ = R + q | 0;
                            Z = S & 255;
                            W = W & 255;
                            S = R + e | 0;
                            U = Y & 255;
                            P = P & 255;
                            Y = ((W - Z | 0) * 9 | 0) + 8 + ($(U - V | 0, -3) | 0) >> 4;
                            if ((((Y | 0) > -1 ? Y : 0 - Y | 0) | 0) < (I | 0)) {
                                if ((Y | 0) < (J | 0)) Y = J;
                                else Y = (Y | 0) > (G | 0) ? G : Y;
                                if (!K) {
                                    aa = Y + Z | 0;
                                    if (aa >>> 0 > 255) aa = 0 - aa >> 31;
                                    a[_ >> 0] = aa
                                }
                                if (!L) {
                                    _ = W - Y | 0;
                                    if (_ >>> 0 > 255) _ = 0 - _ >> 31;
                                    a[R >> 0] = _
                                }
                                if (M) {
                                    X = ((X + 1 + Z | 0) >>> 1) - V + Y >> 1;
                                    if ((X | 0) < (N | 0)) X = N;
                                    else X = (X | 0) > (H | 0) ? H : X;
                                    V = X + V | 0;
                                    if (V >>> 0 > 255) V = 0 - V >> 31;
                                    a[T >> 0] = V
                                }
                                if (O) {
                                    P = ((W + 1 + P | 0) >>> 1) - U - Y >> 1;
                                    if ((P | 0) < (N | 0)) P = N;
                                    else P = (P | 0) > (H | 0) ? H : P;
                                    P = P + U | 0;
                                    if (P >>> 0 > 255) P = 0 - P >> 31;
                                    a[S >> 0] = P
                                }
                            }
                            T = R + f | 0;
                            if ((Q | 0) == 4) break;
                            U = a[R + (o + f) >> 0] | 0;
                            V = a[R + (p + f) >> 0] | 0;
                            S = a[R + (f - e) >> 0] | 0;
                            W = a[T >> 0] | 0;
                            Y = a[R + (f + e) >> 0] | 0;
                            P = a[R + (r + f) >> 0] | 0;
                            Q = Q + 1 | 0;
                            R = T
                        }
                        b = b + m | 0
                    } else b = b + z | 0;
                while (0);
                F = F + 1 | 0
            } while ((F | 0) != 2);
            i = t;
            return
        }

        function pd(e, f, g, h, j, k, l, m, n, o) {
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            m = m | 0;
            n = n | 0;
            o = o | 0;
            var p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0;
            t = i;
            v = c[j + (m << 2) + 100 >> 2] | 0;
            q = a[2896 + (v << 2) >> 0] | 0;
            r = a[2898 + (v << 2) >> 0] | 0;
            if ((o | 0) >= (l | 0)) {
                i = t;
                return
            }
            u = (n | 0) < (k | 0);
            s = o;
            p = $((a[2897 + (v << 2) >> 0] | 0) + o | 0, h) | 0;
            v = $((a[2899 + (v << 2) >> 0] | 0) + o | 0, h) | 0;
            w = $(o, g) | 0;
            o = $(o, h) | 0;
            while (1) {
                if (u) {
                    y = p + q | 0;
                    x = v + r | 0;
                    z = n;
                    do {
                        A = a[f + (z + o) >> 0] | 0;
                        B = a[f + (y + z) >> 0] | 0;
                        if ((A & 255) > (B & 255)) B = 3;
                        else B = ((A << 24 >> 24 != B << 24 >> 24) << 31 >> 31) + 2 | 0;
                        C = a[f + (x + z) >> 0] | 0;
                        if ((A & 255) > (C & 255)) C = 1;
                        else C = (A << 24 >> 24 != C << 24 >> 24) << 31 >> 31;
                        A = (b[j + (m * 10 | 0) + (d[2888 + (C + B) >> 0] << 1) + 112 >> 1] | 0) + (A & 255) | 0;
                        if (A >>> 0 > 255) A = 0 - A >> 31;
                        a[e + (z + w) >> 0] = A;
                        z = z + 1 | 0
                    } while ((z | 0) != (k | 0))
                }
                s = s + 1 | 0;
                if ((s | 0) == (l | 0)) break;
                else {
                    p = p + h | 0;
                    v = v + h | 0;
                    w = w + g | 0;
                    o = o + h | 0
                }
            }
            i = t;
            return
        }

        function qd(b, e, f, g, h) {
            b = b | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            var j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0;
            j = i;
            k = c[b + 136 >> 2] | 0;
            l = (c[b + 200 >> 2] | 0) + 13080 | 0;
            r = (1 << c[l >> 2]) + -1 | 0;
            o = r & e;
            n = r & f;
            q = (n | 0) != 0 | (a[k + 309 >> 0] | 0) != 0;
            m = q & 1;
            c[k + 31296 >> 2] = m;
            p = (o | 0) != 0 | (a[k + 308 >> 0] | 0) != 0;
            b = p & 1;
            c[k + 31292 >> 2] = b;
            if (!(r & (f | e))) p = d[k + 311 >> 0] | 0;
            else p = p & q & 1;
            c[k + 31300 >> 2] = p;
            if ((o + g | 0) == (1 << c[l >> 2] | 0)) m = (a[k + 310 >> 0] | 0) != 0 & (n | 0) == 0 & 1;
            c[k + 31308 >> 2] = m;
            if (!m) {
                q = 0;
                q = q & 1;
                r = k + 31304 | 0;
                c[r >> 2] = q;
                r = h + f | 0;
                q = k + 316 | 0;
                q = c[q >> 2] | 0;
                q = (r | 0) < (q | 0);
                q = q ? b : 0;
                r = k + 31288 | 0;
                c[r >> 2] = q;
                i = j;
                return
            }
            q = (g + e | 0) < (c[k + 312 >> 2] | 0);
            q = q & 1;
            r = k + 31304 | 0;
            c[r >> 2] = q;
            r = h + f | 0;
            q = k + 316 | 0;
            q = c[q >> 2] | 0;
            q = (r | 0) < (q | 0);
            q = q ? b : 0;
            r = k + 31288 | 0;
            c[r >> 2] = q;
            i = j;
            return
        }

        function rd(e, f, g, h, j, k, l, m, n) {
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            m = m | 0;
            n = n | 0;
            var o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                D = 0,
                E = 0,
                F = 0,
                G = 0,
                H = 0,
                I = 0,
                J = 0,
                K = 0,
                L = 0,
                M = 0,
                N = 0,
                O = 0,
                P = 0,
                Q = 0,
                R = 0,
                S = 0,
                T = 0,
                U = 0,
                V = 0,
                W = 0,
                X = 0,
                Y = 0,
                Z = 0,
                _ = 0,
                aa = 0,
                ba = 0,
                ca = 0,
                da = 0,
                ea = 0,
                fa = 0,
                ga = 0,
                ha = 0,
                ia = 0,
                ja = 0,
                ka = 0,
                la = 0,
                ma = 0,
                na = 0,
                oa = 0,
                pa = 0,
                qa = 0,
                ra = 0,
                sa = 0,
                ta = 0,
                ua = 0,
                va = 0,
                wa = 0,
                xa = 0,
                ya = 0,
                za = 0,
                Aa = 0,
                Ba = 0,
                Ca = 0;
            o = i;
            i = i + 80 | 0;
            t = o + 4 | 0;
            s = o;
            xa = o + 11 & -4;
            p = xa;
            q = e + 136 | 0;
            r = c[q >> 2] | 0;
            G = e + 204 | 0;
            if ((1 << k | 0) == 8 ? (c[(c[G >> 2] | 0) + 1620 >> 2] | 0) > 2 : 0) {
                v = 8;
                u = 8;
                l = 0;
                Aa = 1;
                f = c[r + 31236 >> 2] | 0;
                g = c[r + 31240 >> 2] | 0
            } else {
                v = j;
                u = h;
                Aa = 0
            }
            qd(e, f, g, u, v);
            ya = c[q >> 2] | 0;
            A = c[e + 3508 >> 2] | 0;
            k = c[A + 20 >> 2] | 0;
            A = c[A + 16 >> 2] | 0;
            Z = e + 200 | 0;
            Ba = c[Z >> 2] | 0;
            V = c[Ba + 13156 >> 2] | 0;
            la = c[ya + 31288 >> 2] | 0;
            za = c[ya + 31292 >> 2] | 0;
            _ = c[ya + 31300 >> 2] | 0;
            wa = c[ya + 31296 >> 2] | 0;
            ta = c[ya + 31308 >> 2] | 0;
            X = f + -1 | 0;
            ma = g + v | 0;
            W = ma + -1 | 0;
            ua = f + u | 0;
            S = ua + -1 | 0;
            Y = g + -1 | 0;
            q = e + 2428 | 0;
            r = c[e + 3036 >> 2] | 0;
            if ((c[q >> 2] | 0) != 1) {
                Ca = c[e + 3040 >> 2] | 0;
                r = r >>> 0 > Ca >>> 0 ? Ca : r
            }
            l = (Aa | 0) == 0 & (l | 0) == 1;
            if (l ? (va = c[ya + 31248 >> 2] | 0, (va | 0) == 7 | (va | 0) == 6 | (va | 0) == 2) : 0) {
                l = va;
                xa = 0;
                ya = 0;
                va = 14
            } else va = 7;
            do
                if ((va | 0) == 7) {
                    Aa = c[(c[G >> 2] | 0) + 1620 >> 2] & 255;
                    if ((X >> Aa | 0) == (f >> Aa | 0)) Aa = (W >> Aa | 0) == (g >> Aa | 0);
                    else Aa = 0;
                    if (!(Aa | (za | 0) == 0)) {
                        za = c[Ba + 13084 >> 2] | 0;
                        za = ($(W >> za, V) | 0) + (X >> za) | 0;
                        Ca = (a[A + (za * 12 | 0) + 10 >> 0] | 0) != 0;
                        Aa = Ca & 1;
                        if (Ca) {
                            Ba = A + (za * 12 | 0) | 0;
                            Ca = xa;
                            c[Ca + 0 >> 2] = c[Ba + 0 >> 2];
                            c[Ca + 4 >> 2] = c[Ba + 4 >> 2];
                            c[Ca + 8 >> 2] = c[Ba + 8 >> 2];
                            if (!m) break;
                            else {
                                xa = Aa;
                                va = 1
                            }
                        } else {
                            xa = Aa;
                            va = 0
                        }
                    } else {
                        xa = 0;
                        va = 0
                    }
                    if (l) {
                        l = c[ya + 31248 >> 2] | 0;
                        ya = va;
                        va = 14
                    } else {
                        ya = va;
                        va = 15
                    }
                }
            while (0);
            if ((va | 0) == 14)
                if ((l | 0) == 5 | (l | 0) == 4 | (l | 0) == 1) {
                    wa = 0;
                    va = 30
                } else va = 15;
            a: do
                if ((va | 0) == 15) {
                    l = c[(c[G >> 2] | 0) + 1620 >> 2] & 255;
                    if ((S >> l | 0) == (f >> l | 0)) l = (Y >> l | 0) == (g >> l | 0);
                    else l = 0;
                    if (!(l | (wa | 0) == 0)) {
                        za = c[(c[Z >> 2] | 0) + 13084 >> 2] | 0;
                        Aa = ($(Y >> za, V) | 0) + (S >> za) | 0;
                        Ba = a[A + (Aa * 12 | 0) + 10 >> 0] | 0;
                        Ca = Ba << 24 >> 24 != 0;
                        wa = Ca & 1;
                        if (Ca) {
                            l = A + (Aa * 12 | 0) | 0;
                            do
                                if ((xa | 0) != 0 ? (Ca = ($(W >> za, V) | 0) + (X >> za) | 0, oa = A + (Ca * 12 | 0) | 0, na = d[l >> 0] | d[l + 1 >> 0] << 8 | d[l + 2 >> 0] << 16 | d[l + 3 >> 0] << 24, qa = A + (Aa * 12 | 0) + 4 | 0, qa = d[qa >> 0] | d[qa + 1 >> 0] << 8 | d[qa + 2 >> 0] << 16 | d[qa + 3 >> 0] << 24, sa = A + (Aa * 12 | 0) + 8 | 0, sa = d[sa >> 0] | d[sa + 1 >> 0] << 8, oa = d[oa >> 0] | d[oa + 1 >> 0] << 8 | d[oa + 2 >> 0] << 16 | d[oa + 3 >> 0] << 24, pa = A + (Ca * 12 | 0) + 4 | 0, pa = d[pa >> 0] | d[pa + 1 >> 0] << 8 | d[pa + 2 >> 0] << 16 | d[pa + 3 >> 0] << 24, ra = A + (Ca * 12 | 0) + 8 | 0, ra = d[ra >> 0] | d[ra + 1 >> 0] << 8, Ba << 24 >> 24 == (a[A + (Ca * 12 | 0) + 10 >> 0] | 0)) : 0) {
                                    if (Ba << 24 >> 24 == 1) na = ((na | 0) == (oa | 0) ? (sa & 255) << 24 >> 24 == (ra & 255) << 24 >> 24 : 0) & 1;
                                    else if (Ba << 24 >> 24 == 3) {
                                        if ((sa & 255) << 24 >> 24 == (ra & 255) << 24 >> 24) na = ((na | 0) == (oa | 0) ? ((sa & 65535) >>> 8 & 255) << 24 >> 24 == ((ra & 65535) >>> 8 & 255) << 24 >> 24 : 0) & (qa | 0) == (pa | 0);
                                        else na = 0;
                                        na = na & 1
                                    } else if (Ba << 24 >> 24 == 2) na = ((qa | 0) == (pa | 0) ? ((sa & 65535) >>> 8 & 255) << 24 >> 24 == ((ra & 65535) >>> 8 & 255) << 24 >> 24 : 0) & 1;
                                    else break;
                                    if (na) {
                                        va = 30;
                                        break a
                                    }
                                }
                            while (0);
                            Ca = p + (ya * 12 | 0) | 0;
                            c[Ca + 0 >> 2] = c[l + 0 >> 2];
                            c[Ca + 4 >> 2] = c[l + 4 >> 2];
                            c[Ca + 8 >> 2] = c[l + 8 >> 2];
                            if ((ya | 0) != (m | 0)) {
                                ya = ya + 1 | 0;
                                va = 30
                            }
                        } else va = 30
                    } else {
                        wa = 0;
                        va = 30
                    }
                }
            while (0);
            b: do
                if ((va | 0) == 30) {
                    c: do
                        if (((ta | 0) != 0 ? (ka = c[Z >> 2] | 0, da = c[ka + 13084 >> 2] | 0, ba = $(Y >> da, V) | 0, ca = ba + (ua >> da) | 0, aa = a[A + (ca * 12 | 0) + 10 >> 0] | 0, aa << 24 >> 24 != 0) : 0) ? (ua | 0) < (c[ka + 13120 >> 2] | 0) : 0) {
                            Ca = c[ka + 13080 >> 2] | 0;
                            if (((Y >> Ca | 0) >= (g >> Ca | 0) ? (ua >> Ca | 0) >= (f >> Ca | 0) : 0) ? (za = c[ka + 13072 >> 2] | 0, Aa = c[ka + 13164 >> 2] | 0, l = Aa + 2 | 0, Ca = ($(g >> za & Aa, l) | 0) + (f >> za & Aa) | 0, Ba = c[(c[G >> 2] | 0) + 1684 >> 2] | 0, (c[Ba + (($(Y >> za & Aa, l) | 0) + (ua >> za & Aa) << 2) >> 2] | 0) > (c[Ba + (Ca << 2) >> 2] | 0)) : 0) break;
                            Ca = c[(c[G >> 2] | 0) + 1620 >> 2] & 255;
                            if ((ua >> Ca | 0) == (f >> Ca | 0) ? (Y >> Ca | 0) == (g >> Ca | 0) : 0) break;
                            ka = A + (ca * 12 | 0) | 0;
                            do
                                if ((wa | 0) != 0 ? (Ca = ba + (S >> da) | 0, fa = A + (Ca * 12 | 0) | 0, ea = d[ka >> 0] | d[ka + 1 >> 0] << 8 | d[ka + 2 >> 0] << 16 | d[ka + 3 >> 0] << 24, ia = A + (ca * 12 | 0) + 4 | 0, ia = d[ia >> 0] | d[ia + 1 >> 0] << 8 | d[ia + 2 >> 0] << 16 | d[ia + 3 >> 0] << 24, ga = A + (ca * 12 | 0) + 8 | 0, ga = d[ga >> 0] | d[ga + 1 >> 0] << 8, fa = d[fa >> 0] | d[fa + 1 >> 0] << 8 | d[fa + 2 >> 0] << 16 | d[fa + 3 >> 0] << 24, ja = A + (Ca * 12 | 0) + 4 | 0, ja = d[ja >> 0] | d[ja + 1 >> 0] << 8 | d[ja + 2 >> 0] << 16 | d[ja + 3 >> 0] << 24, ha = A + (Ca * 12 | 0) + 8 | 0, ha = d[ha >> 0] | d[ha + 1 >> 0] << 8, aa << 24 >> 24 == (a[A + (Ca * 12 | 0) + 10 >> 0] | 0)) : 0) {
                                    if (aa << 24 >> 24 == 1) aa = ((ea | 0) == (fa | 0) ? (ga & 255) << 24 >> 24 == (ha & 255) << 24 >> 24 : 0) & 1;
                                    else if (aa << 24 >> 24 == 2) aa = ((ia | 0) == (ja | 0) ? ((ga & 65535) >>> 8 & 255) << 24 >> 24 == ((ha & 65535) >>> 8 & 255) << 24 >> 24 : 0) & 1;
                                    else if (aa << 24 >> 24 == 3) {
                                        if ((ga & 255) << 24 >> 24 == (ha & 255) << 24 >> 24) aa = ((ea | 0) == (fa | 0) ? ((ga & 65535) >>> 8 & 255) << 24 >> 24 == ((ha & 65535) >>> 8 & 255) << 24 >> 24 : 0) & (ia | 0) == (ja | 0);
                                        else aa = 0;
                                        aa = aa & 1
                                    } else break;
                                    if (aa) break c
                                }
                            while (0);
                            Ca = p + (ya * 12 | 0) | 0;
                            c[Ca + 0 >> 2] = c[ka + 0 >> 2];
                            c[Ca + 4 >> 2] = c[ka + 4 >> 2];
                            c[Ca + 8 >> 2] = c[ka + 8 >> 2];
                            if ((ya | 0) == (m | 0)) break b;
                            ya = ya + 1 | 0
                        }while (0);d: do
                        if (((la | 0) != 0 ? (U = c[Z >> 2] | 0, N = c[U + 13084 >> 2] | 0, O = X >> N, J = ($(ma >> N, V) | 0) + O | 0, M = a[A + (J * 12 | 0) + 10 >> 0] | 0, M << 24 >> 24 != 0) : 0) ? (ma | 0) < (c[U + 13124 >> 2] | 0) : 0) {
                            Ca = c[U + 13080 >> 2] | 0;
                            if (((ma >> Ca | 0) >= (g >> Ca | 0) ? (X >> Ca | 0) >= (f >> Ca | 0) : 0) ? (za = c[U + 13072 >> 2] | 0, Aa = c[U + 13164 >> 2] | 0, l = Aa + 2 | 0, Ca = ($(g >> za & Aa, l) | 0) + (f >> za & Aa) | 0, Ba = c[(c[G >> 2] | 0) + 1684 >> 2] | 0, (c[Ba + (($(ma >> za & Aa, l) | 0) + (X >> za & Aa) << 2) >> 2] | 0) > (c[Ba + (Ca << 2) >> 2] | 0)) : 0) break;
                            Ca = c[(c[G >> 2] | 0) + 1620 >> 2] & 255;
                            if ((X >> Ca | 0) == (f >> Ca | 0) ? (ma >> Ca | 0) == (g >> Ca | 0) : 0) break;
                            U = A + (J * 12 | 0) | 0;
                            do
                                if ((xa | 0) != 0 ? (Ca = ($(W >> N, V) | 0) + O | 0, R = A + (Ca * 12 | 0) | 0, Q = d[U >> 0] | d[U + 1 >> 0] << 8 | d[U + 2 >> 0] << 16 | d[U + 3 >> 0] << 24, P = A + (J * 12 | 0) + 4 | 0, P = d[P >> 0] | d[P + 1 >> 0] << 8 | d[P + 2 >> 0] << 16 | d[P + 3 >> 0] << 24, T = A + (J * 12 | 0) + 8 | 0, T = d[T >> 0] | d[T + 1 >> 0] << 8, R = d[R >> 0] | d[R + 1 >> 0] << 8 | d[R + 2 >> 0] << 16 | d[R + 3 >> 0] << 24, L = A + (Ca * 12 | 0) + 4 | 0, L = d[L >> 0] | d[L + 1 >> 0] << 8 | d[L + 2 >> 0] << 16 | d[L + 3 >> 0] << 24, K = A + (Ca * 12 | 0) + 8 | 0, K = d[K >> 0] | d[K + 1 >> 0] << 8, M << 24 >> 24 == (a[A + (Ca * 12 | 0) + 10 >> 0] | 0)) : 0) {
                                    if (M << 24 >> 24 == 3) {
                                        if ((T & 255) << 24 >> 24 == (K & 255) << 24 >> 24) J = ((Q | 0) == (R | 0) ? ((T & 65535) >>> 8 & 255) << 24 >> 24 == ((K & 65535) >>> 8 & 255) << 24 >> 24 : 0) & (P | 0) == (L | 0);
                                        else J = 0;
                                        J = J & 1
                                    } else if (M << 24 >> 24 == 1) J = ((Q | 0) == (R | 0) ? (T & 255) << 24 >> 24 == (K & 255) << 24 >> 24 : 0) & 1;
                                    else if (M << 24 >> 24 == 2) J = ((P | 0) == (L | 0) ? ((T & 65535) >>> 8 & 255) << 24 >> 24 == ((K & 65535) >>> 8 & 255) << 24 >> 24 : 0) & 1;
                                    else break;
                                    if (J) break d
                                }
                            while (0);
                            Ca = p + (ya * 12 | 0) | 0;
                            c[Ca + 0 >> 2] = c[U + 0 >> 2];
                            c[Ca + 4 >> 2] = c[U + 4 >> 2];
                            c[Ca + 8 >> 2] = c[U + 8 >> 2];
                            if ((ya | 0) == (m | 0)) break b;
                            ya = ya + 1 | 0
                        }while (0);e: do
                        if ((_ | 0) != 0 ? (z = c[(c[Z >> 2] | 0) + 13084 >> 2] | 0, y = $(Y >> z, V) | 0, F = X >> z, x = y + F | 0, w = a[A + (x * 12 | 0) + 10 >> 0] | 0, w << 24 >> 24 != 0) : 0) {
                            Ca = c[(c[G >> 2] | 0) + 1620 >> 2] & 255;
                            if ((X >> Ca | 0) == (f >> Ca | 0) ? (Y >> Ca | 0) == (g >> Ca | 0) : 0) break;
                            do
                                if ((xa | 0) != 0 ? (E = A + (x * 12 | 0) | 0, Ca = ($(W >> z, V) | 0) + F | 0, B = A + (Ca * 12 | 0) | 0, E = d[E >> 0] | d[E + 1 >> 0] << 8 | d[E + 2 >> 0] << 16 | d[E + 3 >> 0] << 24, D = A + (x * 12 | 0) + 4 | 0, D = d[D >> 0] | d[D + 1 >> 0] << 8 | d[D + 2 >> 0] << 16 | d[D + 3 >> 0] << 24, I = A + (x * 12 | 0) + 8 | 0, I = d[I >> 0] | d[I + 1 >> 0] << 8, B = d[B >> 0] | d[B + 1 >> 0] << 8 | d[B + 2 >> 0] << 16 | d[B + 3 >> 0] << 24, H = A + (Ca * 12 | 0) + 4 | 0, H = d[H >> 0] | d[H + 1 >> 0] << 8 | d[H + 2 >> 0] << 16 | d[H + 3 >> 0] << 24, C = A + (Ca * 12 | 0) + 8 | 0, C = d[C >> 0] | d[C + 1 >> 0] << 8, w << 24 >> 24 == (a[A + (Ca * 12 | 0) + 10 >> 0] | 0)) : 0) {
                                    if (w << 24 >> 24 == 3) {
                                        if ((I & 255) << 24 >> 24 == (C & 255) << 24 >> 24) B = ((E | 0) == (B | 0) ? ((I & 65535) >>> 8 & 255) << 24 >> 24 == ((C & 65535) >>> 8 & 255) << 24 >> 24 : 0) & (D | 0) == (H | 0);
                                        else B = 0;
                                        B = B & 1
                                    } else if (w << 24 >> 24 == 1) B = ((E | 0) == (B | 0) ? (I & 255) << 24 >> 24 == (C & 255) << 24 >> 24 : 0) & 1;
                                    else if (w << 24 >> 24 == 2) B = ((D | 0) == (H | 0) ? ((I & 65535) >>> 8 & 255) << 24 >> 24 == ((C & 65535) >>> 8 & 255) << 24 >> 24 : 0) & 1;
                                    else break;
                                    if (B) break e
                                }
                            while (0);
                            if (wa) {
                                B = A + (x * 12 | 0) | 0;
                                Ca = y + (S >> z) | 0;
                                C = A + (Ca * 12 | 0) | 0;
                                z = d[B >> 0] | d[B + 1 >> 0] << 8 | d[B + 2 >> 0] << 16 | d[B + 3 >> 0] << 24;
                                y = A + (x * 12 | 0) + 4 | 0;
                                y = d[y >> 0] | d[y + 1 >> 0] << 8 | d[y + 2 >> 0] << 16 | d[y + 3 >> 0] << 24;
                                x = A + (x * 12 | 0) + 8 | 0;
                                x = d[x >> 0] | d[x + 1 >> 0] << 8;
                                C = d[C >> 0] | d[C + 1 >> 0] << 8 | d[C + 2 >> 0] << 16 | d[C + 3 >> 0] << 24;
                                D = A + (Ca * 12 | 0) + 4 | 0;
                                D = d[D >> 0] | d[D + 1 >> 0] << 8 | d[D + 2 >> 0] << 16 | d[D + 3 >> 0] << 24;
                                E = A + (Ca * 12 | 0) + 8 | 0;
                                E = d[E >> 0] | d[E + 1 >> 0] << 8;
                                do
                                    if (w << 24 >> 24 == (a[A + (Ca * 12 | 0) + 10 >> 0] | 0))
                                        if (w << 24 >> 24 == 1) {
                                            w = ((z | 0) == (C | 0) ? (x & 255) << 24 >> 24 == (E & 255) << 24 >> 24 : 0) & 1;
                                            break
                                        } else if (w << 24 >> 24 == 2) {
                                    w = ((y | 0) == (D | 0) ? ((x & 65535) >>> 8 & 255) << 24 >> 24 == ((E & 65535) >>> 8 & 255) << 24 >> 24 : 0) & 1;
                                    break
                                } else if (w << 24 >> 24 == 3) {
                                    if ((x & 255) << 24 >> 24 == (E & 255) << 24 >> 24) w = ((z | 0) == (C | 0) ? ((x & 65535) >>> 8 & 255) << 24 >> 24 == ((E & 65535) >>> 8 & 255) << 24 >> 24 : 0) & (y | 0) == (D | 0);
                                    else w = 0;
                                    w = w & 1;
                                    break
                                } else {
                                    w = 0;
                                    break
                                } else w = 0;
                                while (0);
                                if ((w | 0) != 0 | (ya | 0) == 4) break
                            } else {
                                if ((ya | 0) == 4) {
                                    ya = 4;
                                    break
                                }
                                B = A + (x * 12 | 0) | 0
                            }
                            Ca = p + (ya * 12 | 0) | 0;
                            c[Ca + 0 >> 2] = c[B + 0 >> 2];
                            c[Ca + 4 >> 2] = c[B + 4 >> 2];
                            c[Ca + 8 >> 2] = c[B + 8 >> 2];
                            if ((ya | 0) == (m | 0)) break b;
                            ya = ya + 1 | 0
                        }while (0);w = e + 3080 | 0;
                    if ((a[e + 3035 >> 0] | 0) != 0 ? ya >>> 0 < (c[w >> 2] | 0) >>> 0 : 0) {
                        c[t >> 2] = 0;
                        c[s >> 2] = 0;
                        x = vd(e, f, g, u, v, 0, t, 0) | 0;
                        if (!(c[q >> 2] | 0)) e = vd(e, f, g, u, v, 0, s, 1) | 0;
                        else e = 0;
                        if (e | x) {
                            a[p + (ya * 12 | 0) + 10 >> 0] = (e << 1) + x;
                            b[p + (ya * 12 | 0) + 8 >> 1] = 0;
                            c[p + (ya * 12 | 0) >> 2] = c[t >> 2];
                            c[p + (ya * 12 | 0) + 4 >> 2] = c[s >> 2];
                            if ((ya | 0) == (m | 0)) break;
                            ya = ya + 1 | 0
                        }
                    }
                    e = c[w >> 2] | 0;f: do
                        if ((c[q >> 2] | 0) == 0 & (ya | 0) > 1 & ya >>> 0 < e >>> 0) {
                            s = $(ya + -1 | 0, ya) | 0;
                            t = 0;
                            while (1) {
                                if ((t | 0) >= (s | 0)) break f;
                                Ba = d[2912 + (t << 1) >> 0] | 0;
                                Ca = d[2913 + (t << 1) >> 0] | 0;
                                f = c[p + (Ba * 12 | 0) >> 2] | 0;
                                g = a[p + (Ba * 12 | 0) + 8 >> 0] | 0;
                                v = c[p + (Ca * 12 | 0) + 4 >> 2] | 0;
                                u = a[p + (Ca * 12 | 0) + 9 >> 0] | 0;
                                if (((a[p + (Ba * 12 | 0) + 10 >> 0] & 1) != 0 ? (a[p + (Ca * 12 | 0) + 10 >> 0] & 2) != 0 : 0) ? !((f | 0) == (v | 0) ? (c[k + (g << 24 >> 24 << 2) + 64 >> 2] | 0) == (c[k + (u << 24 >> 24 << 2) + 260 >> 2] | 0) : 0) : 0) {
                                    a[p + (ya * 12 | 0) + 8 >> 0] = g;
                                    a[p + (ya * 12 | 0) + 9 >> 0] = u;
                                    a[p + (ya * 12 | 0) + 10 >> 0] = 3;
                                    c[p + (ya * 12 | 0) >> 2] = f;
                                    c[p + (ya * 12 | 0) + 4 >> 2] = v;
                                    if ((ya | 0) == (m | 0)) break b;
                                    e = c[w >> 2] | 0;
                                    ya = ya + 1 | 0
                                }
                                if (ya >>> 0 < e >>> 0) t = t + 1 | 0;
                                else break
                            }
                        }while (0);
                    if (ya >>> 0 < e >>> 0) {
                        k = 0;
                        while (1) {
                            a[p + (ya * 12 | 0) + 10 >> 0] = ((c[q >> 2] | 0) == 0 & 1) << 1 | 1;
                            c[p + (ya * 12 | 0) >> 2] = 0;
                            c[p + (ya * 12 | 0) + 4 >> 2] = 0;
                            Ca = (k | 0) < (r | 0) ? k & 255 : 0;
                            a[p + (ya * 12 | 0) + 8 >> 0] = Ca;
                            a[p + (ya * 12 | 0) + 9 >> 0] = Ca;
                            if ((ya | 0) == (m | 0)) break b;
                            ya = ya + 1 | 0;
                            if (ya >>> 0 >= (c[w >> 2] | 0) >>> 0) break b;
                            k = k + 1 | 0
                        }
                    }
                }
            while (0);
            q = p + (m * 12 | 0) | 0;
            p = p + (m * 12 | 0) + 10 | 0;
            if ((a[p >> 0] | 0) != 3) {
                c[n + 0 >> 2] = c[q + 0 >> 2];
                c[n + 4 >> 2] = c[q + 4 >> 2];
                c[n + 8 >> 2] = c[q + 8 >> 2];
                i = o;
                return
            }
            if ((j + h | 0) != 12) {
                c[n + 0 >> 2] = c[q + 0 >> 2];
                c[n + 4 >> 2] = c[q + 4 >> 2];
                c[n + 8 >> 2] = c[q + 8 >> 2];
                i = o;
                return
            }
            a[p >> 0] = 1;
            c[n + 0 >> 2] = c[q + 0 >> 2];
            c[n + 4 >> 2] = c[q + 4 >> 2];
            c[n + 8 >> 2] = c[q + 8 >> 2];
            i = o;
            return
        }

        function sd(d, e, f, g, h, j, k, l, m, n, o) {
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            m = m | 0;
            n = n | 0;
            o = o | 0;
            var p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                D = 0,
                E = 0,
                F = 0,
                G = 0,
                H = 0,
                I = 0,
                J = 0;
            k = i;
            i = i + 32 | 0;
            j = k;
            r = k + 16 | 0;
            q = k + 12 | 0;
            l = k + 8 | 0;
            H = c[d + 136 >> 2] | 0;
            z = c[(c[d + 3508 >> 2] | 0) + 16 >> 2] | 0;
            u = d + 200 | 0;
            F = c[u >> 2] | 0;
            A = c[F + 13156 >> 2] | 0;
            x = j;
            c[x >> 2] = 0;
            c[x + 4 >> 2] = 0;
            x = c[H + 31292 >> 2] | 0;
            B = c[H + 31300 >> 2] | 0;
            C = c[H + 31296 >> 2] | 0;
            E = c[H + 31308 >> 2] | 0;
            p = a[m + o + 8 >> 0] | 0;
            s = (o | 0) == 0 & 1;
            t = e + -1 | 0;
            w = h + f | 0;
            if (((c[H + 31288 >> 2] | 0) != 0 ? (H = c[F + 13084 >> 2] | 0, (a[z + ((($(w >> H, A) | 0) + (t >> H) | 0) * 12 | 0) + 10 >> 0] | 0) != 0) : 0) ? (w | 0) < (c[F + 13124 >> 2] | 0) : 0) {
                H = c[F + 13080 >> 2] | 0;
                if ((w >> H | 0) >= (f >> H | 0) ? (t >> H | 0) >= (e >> H | 0) : 0) {
                    I = c[F + 13072 >> 2] | 0;
                    D = c[F + 13164 >> 2] | 0;
                    J = D + 2 | 0;
                    G = ($(f >> I & D, J) | 0) + (e >> I & D) | 0;
                    H = c[(c[d + 204 >> 2] | 0) + 1684 >> 2] | 0;
                    G = (c[H + (($(w >> I & D, J) | 0) + (t >> I & D) << 2) >> 2] | 0) <= (c[H + (G << 2) >> 2] | 0)
                } else G = 1
            } else G = 0;
            D = w + -1 | 0;
            if (!x) H = 0;
            else {
                H = c[F + 13084 >> 2] | 0;
                H = (a[z + ((($(D >> H, A) | 0) + (t >> H) | 0) * 12 | 0) + 10 >> 0] | 0) != 0
            }
            x = G | H;
            if (G) {
                J = c[F + 13084 >> 2] | 0;
                if ((td(d, t >> J, w >> J, o, r, o, p) | 0) == 0 ? (J = c[(c[u >> 2] | 0) + 13084 >> 2] | 0, (td(d, t >> J, w >> J, s, r, o, p) | 0) == 0) : 0) v = 12;
                else F = 1
            } else v = 12;
            do
                if ((v | 0) == 12) {
                    if (H) {
                        J = c[(c[u >> 2] | 0) + 13084 >> 2] | 0;
                        if (td(d, t >> J, D >> J, o, r, o, p) | 0) {
                            F = 1;
                            break
                        }
                        J = c[(c[u >> 2] | 0) + 13084 >> 2] | 0;
                        if (td(d, t >> J, D >> J, s, r, o, p) | 0) {
                            F = 1;
                            break
                        }
                    }
                    if (G) {
                        J = c[(c[u >> 2] | 0) + 13084 >> 2] | 0;
                        if (ud(d, t >> J, w >> J, o, r, o, p) | 0) {
                            F = 1;
                            break
                        }
                        J = c[(c[u >> 2] | 0) + 13084 >> 2] | 0;
                        if (ud(d, t >> J, w >> J, s, r, o, p) | 0) {
                            F = 1;
                            break
                        }
                    }
                    if (H) {
                        J = c[(c[u >> 2] | 0) + 13084 >> 2] | 0;
                        if (ud(d, t >> J, D >> J, o, r, o, p) | 0) {
                            F = 1;
                            break
                        }
                        J = c[(c[u >> 2] | 0) + 13084 >> 2] | 0;
                        if (ud(d, t >> J, D >> J, s, r, o, p) | 0) {
                            F = 1;
                            break
                        }
                    }
                    F = 0
                }
            while (0);
            D = g + e | 0;
            w = f + -1 | 0;
            if (((E | 0) != 0 ? (y = c[u >> 2] | 0, J = c[y + 13084 >> 2] | 0, (a[z + ((($(w >> J, A) | 0) + (D >> J) | 0) * 12 | 0) + 10 >> 0] | 0) != 0) : 0) ? (D | 0) < (c[y + 13120 >> 2] | 0) : 0) {
                J = c[y + 13080 >> 2] | 0;
                if ((w >> J | 0) >= (f >> J | 0) ? (D >> J | 0) >= (e >> J | 0) : 0) {
                    H = c[y + 13072 >> 2] | 0;
                    I = c[y + 13164 >> 2] | 0;
                    G = I + 2 | 0;
                    E = ($(f >> H & I, G) | 0) + (e >> H & I) | 0;
                    J = c[(c[d + 204 >> 2] | 0) + 1684 >> 2] | 0;
                    E = (c[J + (($(w >> H & I, G) | 0) + (D >> H & I) << 2) >> 2] | 0) <= (c[J + (E << 2) >> 2] | 0)
                } else E = 1
            } else E = 0;
            y = D + -1 | 0;
            if (!C) C = 0;
            else {
                C = c[(c[u >> 2] | 0) + 13084 >> 2] | 0;
                C = (a[z + ((($(w >> C, A) | 0) + (y >> C) | 0) * 12 | 0) + 10 >> 0] | 0) != 0
            }
            if (!B) z = 0;
            else {
                J = c[(c[u >> 2] | 0) + 13084 >> 2] | 0;
                z = (a[z + ((($(w >> J, A) | 0) + (t >> J) | 0) * 12 | 0) + 10 >> 0] | 0) != 0
            }
            if (E) {
                J = c[(c[u >> 2] | 0) + 13084 >> 2] | 0;
                if ((td(d, D >> J, w >> J, o, q, o, p) | 0) == 0 ? (J = c[(c[u >> 2] | 0) + 13084 >> 2] | 0, (td(d, D >> J, w >> J, s, q, o, p) | 0) == 0) : 0) v = 35;
                else A = 1
            } else v = 35;
            do
                if ((v | 0) == 35) {
                    if (C) {
                        J = c[(c[u >> 2] | 0) + 13084 >> 2] | 0;
                        if (td(d, y >> J, w >> J, o, q, o, p) | 0) {
                            A = 1;
                            break
                        }
                        J = c[(c[u >> 2] | 0) + 13084 >> 2] | 0;
                        if (td(d, y >> J, w >> J, s, q, o, p) | 0) {
                            A = 1;
                            break
                        }
                    }
                    if (z) {
                        J = c[(c[u >> 2] | 0) + 13084 >> 2] | 0;
                        if (td(d, t >> J, w >> J, o, q, o, p) | 0) {
                            A = 1;
                            break
                        }
                        J = c[(c[u >> 2] | 0) + 13084 >> 2] | 0;
                        if (td(d, t >> J, w >> J, s, q, o, p) | 0) {
                            A = 1;
                            break
                        }
                    }
                    A = 0
                }
            while (0);
            do
                if (!x) {
                    if (A) {
                        c[r >> 2] = c[q >> 2];
                        F = 1
                    }
                    if (E) {
                        A = c[(c[u >> 2] | 0) + 13084 >> 2] | 0;
                        A = ud(d, D >> A, w >> A, o, q, o, p) | 0;
                        if (A) break;
                        A = c[(c[u >> 2] | 0) + 13084 >> 2] | 0;
                        A = ud(d, D >> A, w >> A, s, q, o, p) | 0
                    } else A = 0;
                    if (C & (A | 0) == 0) {
                        A = c[(c[u >> 2] | 0) + 13084 >> 2] | 0;
                        A = ud(d, y >> A, w >> A, o, q, o, p) | 0;
                        if (A) break;
                        A = c[(c[u >> 2] | 0) + 13084 >> 2] | 0;
                        A = ud(d, y >> A, w >> A, s, q, o, p) | 0
                    }
                    if (z & (A | 0) == 0) {
                        A = c[(c[u >> 2] | 0) + 13084 >> 2] | 0;
                        A = ud(d, t >> A, w >> A, o, q, o, p) | 0;
                        if (!A) {
                            A = c[(c[u >> 2] | 0) + 13084 >> 2] | 0;
                            A = ud(d, t >> A, w >> A, s, q, o, p) | 0
                        }
                    }
                }
            while (0);
            t = (F | 0) != 0;
            if (t) {
                c[j >> 2] = c[r >> 2];
                s = 1
            } else s = 0;
            do
                if (A) {
                    if (t) {
                        J = c[r >> 2] | 0;
                        q = c[q >> 2] | 0;
                        if ((J & 65535) << 16 >> 16 == (q & 65535) << 16 >> 16 ? (J >>> 16 & 65535) << 16 >> 16 == (q >>> 16 & 65535) << 16 >> 16 : 0) break
                    } else q = c[q >> 2] | 0;
                    r = s + 1 | 0;
                    c[j + (s << 2) >> 2] = q;
                    if (r >>> 0 < 2) s = r;
                    else {
                        J = m + (o << 2) | 0;
                        I = j + (n << 2) | 0;
                        I = c[I >> 2] | 0;
                        b[J >> 1] = I;
                        b[J + 2 >> 1] = I >>> 16;
                        i = k;
                        return
                    }
                }
            while (0);
            if (!((a[d + 3035 >> 0] | 0) != 0 & (s | 0) == (n | 0))) {
                J = m + (o << 2) | 0;
                I = j + (n << 2) | 0;
                I = c[I >> 2] | 0;
                b[J >> 1] = I;
                b[J + 2 >> 1] = I >>> 16;
                i = k;
                return
            }
            if (!(vd(d, e, f, g, h, p, l, o) | 0)) {
                J = m + (o << 2) | 0;
                I = j + (n << 2) | 0;
                I = c[I >> 2] | 0;
                b[J >> 1] = I;
                b[J + 2 >> 1] = I >>> 16;
                i = k;
                return
            }
            c[j + (n << 2) >> 2] = c[l >> 2];
            J = m + (o << 2) | 0;
            I = j + (n << 2) | 0;
            I = c[I >> 2] | 0;
            b[J >> 1] = I;
            b[J + 2 >> 1] = I >>> 16;
            i = k;
            return
        }

        function td(d, f, g, h, j, k, l) {
            d = d | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            var m = 0,
                n = 0,
                o = 0;
            o = i;
            n = c[d + 3508 >> 2] | 0;
            m = c[n + 16 >> 2] | 0;
            n = c[n + 20 >> 2] | 0;
            f = ($(c[(c[d + 200 >> 2] | 0) + 13156 >> 2] | 0, g) | 0) + f | 0;
            if (!(a[m + (f * 12 | 0) + 10 >> 0] & 1 << h)) {
                d = 0;
                i = o;
                return d | 0
            }
            if ((c[n + (h * 196 | 0) + (a[m + (f * 12 | 0) + h + 8 >> 0] << 2) + 64 >> 2] | 0) != (c[n + (k * 196 | 0) + (l << 2) + 64 >> 2] | 0)) {
                d = 0;
                i = o;
                return d | 0
            }
            d = m + (f * 12 | 0) + (h << 2) | 0;
            d = e[d >> 1] | e[d + 2 >> 1] << 16;
            b[j >> 1] = d;
            b[j + 2 >> 1] = d >>> 16;
            d = 1;
            i = o;
            return d | 0
        }

        function ud(d, f, g, h, j, k, l) {
            d = d | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            var m = 0,
                n = 0,
                o = 0,
                p = 0;
            m = i;
            o = d + 3508 | 0;
            n = c[o >> 2] | 0;
            p = c[n + 16 >> 2] | 0;
            n = c[n + 20 >> 2] | 0;
            g = ($(c[(c[d + 200 >> 2] | 0) + 13156 >> 2] | 0, g) | 0) + f | 0;
            if (!(a[p + (g * 12 | 0) + 10 >> 0] & 1 << h)) {
                g = 0;
                i = m;
                return g | 0
            }
            f = c[n + (k * 196 | 0) + (l << 2) + 128 >> 2] | 0;
            if ((c[n + (h * 196 | 0) + (a[p + (g * 12 | 0) + h + 8 >> 0] << 2) + 128 >> 2] | 0) != (f | 0)) {
                g = 0;
                i = m;
                return g | 0
            }
            n = p + (g * 12 | 0) + (h << 2) | 0;
            n = e[n >> 1] | e[n + 2 >> 1] << 16;
            b[j >> 1] = n;
            b[j + 2 >> 1] = n >>> 16;
            if (f) {
                g = 1;
                i = m;
                return g | 0
            }
            p = c[o >> 2] | 0;
            f = c[p + 20 >> 2] | 0;
            h = c[f + (h * 196 | 0) + (a[(c[p + 16 >> 2] | 0) + (g * 12 | 0) + h + 8 >> 0] << 2) + 64 >> 2] | 0;
            k = c[f + (k * 196 | 0) + (l << 2) + 64 >> 2] | 0;
            if ((h | 0) == (k | 0)) {
                g = 1;
                i = m;
                return g | 0
            }
            d = c[d + 5816 >> 2] | 0;
            l = (d | 0) != (h | 0) ? d - h | 0 : 1;
            d = d - k | 0;
            if ((l + 128 | 0) >>> 0 > 255) k = l >> 31 ^ 127;
            else k = l;
            l = k << 24 >> 24;
            if ((d + 128 | 0) >>> 0 > 255) d = d >> 31 ^ 127;
            g = (l | 0) / 2 | 0;
            d = ($(d << 24 >> 24, (((k & 255) << 24 >> 24 > -2 ? g : 0 - g | 0) + 16384 | 0) / (l | 0) | 0) | 0) + 32 >> 6;
            if ((d | 0) < -4096) d = -4096;
            else d = (d | 0) > 4095 ? 4095 : d;
            k = $(n << 16 >> 16, d) | 0;
            k = k + 127 + (k >>> 31) | 0;
            l = k >> 8;
            if ((l + 32768 | 0) >>> 0 > 65535) l = k >> 31 ^ 32767;
            b[j >> 1] = l;
            n = $(n >> 16, d) | 0;
            n = n + 127 + (n >>> 31) | 0;
            d = n >> 8;
            if ((d + 32768 | 0) >>> 0 > 65535) d = n >> 31 ^ 32767;
            b[j + 2 >> 1] = d;
            g = 1;
            i = m;
            return g | 0
        }

        function vd(d, e, f, g, h, j, k, l) {
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            var m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0;
            s = i;
            i = i + 32 | 0;
            o = s + 12 | 0;
            m = s;
            p = d + 200 | 0;
            u = c[p >> 2] | 0;
            r = c[u + 13156 >> 2] | 0;
            n = c[(c[d + 3508 >> 2] | 0) + 36 >> 2] | 0;
            if (!n) {
                b[k >> 1] = 0;
                b[k + 2 >> 1] = 0 >>> 16;
                w = 0;
                i = s;
                return w | 0
            }
            t = c[n + 16 >> 2] | 0;
            q = c[n + 32 >> 2] | 0;
            v = g + e | 0;
            w = h + f | 0;
            if (!t) {
                w = 0;
                i = s;
                return w | 0
            }
            x = c[u + 13080 >> 2] | 0;
            if (((f >> x | 0) == (w >> x | 0) ? (w | 0) < (c[u + 13124 >> 2] | 0) : 0) ? (v | 0) < (c[u + 13120 >> 2] | 0) : 0) {
                v = v & -16;
                w = w & -16;
                if ((a[d + 140 >> 0] | 0) == 1) u = c[p >> 2] | 0;
                u = c[u + 13084 >> 2] | 0;
                u = t + ((($(w >> u, r) | 0) + (v >> u) | 0) * 12 | 0) | 0;
                c[m + 0 >> 2] = c[u + 0 >> 2];
                c[m + 4 >> 2] = c[u + 4 >> 2];
                c[m + 8 >> 2] = c[u + 8 >> 2];
                u = qc(d, n, v, w) | 0;
                c[o + 0 >> 2] = c[m + 0 >> 2];
                c[o + 4 >> 2] = c[m + 4 >> 2];
                c[o + 8 >> 2] = c[m + 8 >> 2];
                u = wd(d, o, j, k, l, q, u) | 0;
                if (u) {
                    x = u;
                    i = s;
                    return x | 0
                }
            }
            e = (g >> 1) + e & -16;
            h = (h >> 1) + f & -16;
            x = c[(c[p >> 2] | 0) + 13084 >> 2] | 0;
            x = t + ((($(h >> x, r) | 0) + (e >> x) | 0) * 12 | 0) | 0;
            c[m + 0 >> 2] = c[x + 0 >> 2];
            c[m + 4 >> 2] = c[x + 4 >> 2];
            c[m + 8 >> 2] = c[x + 8 >> 2];
            x = qc(d, n, e, h) | 0;
            c[o + 0 >> 2] = c[m + 0 >> 2];
            c[o + 4 >> 2] = c[m + 4 >> 2];
            c[o + 8 >> 2] = c[m + 8 >> 2];
            x = wd(d, o, j, k, l, q, x) | 0;
            i = s;
            return x | 0
        }

        function wd(b, d, e, f, g, h, j) {
            b = b | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            var k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0;
            m = i;
            k = c[(c[b + 3508 >> 2] | 0) + 20 >> 2] | 0;
            n = a[d + 10 >> 0] | 0;
            if (!(n << 24 >> 24)) {
                r = 0;
                i = m;
                return r | 0
            }
            if (!(n & 1)) {
                r = xd(f, d + 4 | 0, h, c[b + 5816 >> 2] | 0, k, g, e, j, 1, a[d + 9 >> 0] | 0) | 0;
                i = m;
                return r | 0
            }
            if (n << 24 >> 24 == 1) {
                r = xd(f, d, h, c[b + 5816 >> 2] | 0, k, g, e, j, 0, a[d + 8 >> 0] | 0) | 0;
                i = m;
                return r | 0
            } else if (n << 24 >> 24 == 3) {
                n = b + 5816 | 0;
                o = c[k + 192 >> 2] | 0;
                a: do
                    if ((o | 0) > 0) {
                        p = c[n >> 2] | 0;
                        q = 0;
                        while (1) {
                            if ((c[k + (q << 2) + 64 >> 2] | 0) > (p | 0)) {
                                p = 1;
                                break a
                            }
                            q = q + 1 | 0;
                            if ((q | 0) >= (o | 0)) {
                                p = 0;
                                break
                            }
                        }
                    } else p = 0;
                while (0);
                o = c[k + 388 >> 2] | 0;
                b: do
                    if ((o | 0) > 0) {
                        q = c[n >> 2] | 0;
                        r = 0;
                        while (1) {
                            if ((c[k + (r << 2) + 260 >> 2] | 0) > (q | 0)) break b;
                            r = r + 1 | 0;
                            if ((r | 0) >= (o | 0)) {
                                l = 21;
                                break
                            }
                        }
                    } else l = 21;
                while (0);
                if ((l | 0) == 21 ? (p | 0) == 0 : 0)
                    if (!g) {
                        r = xd(f, d, h, c[n >> 2] | 0, k, 0, e, j, 0, a[d + 8 >> 0] | 0) | 0;
                        i = m;
                        return r | 0
                    } else {
                        r = xd(f, d + 4 | 0, h, c[n >> 2] | 0, k, g, e, j, 1, a[d + 9 >> 0] | 0) | 0;
                        i = m;
                        return r | 0
                    }
                if ((a[b + 3051 >> 0] | 0) == 1) {
                    r = xd(f, d, h, c[n >> 2] | 0, k, g, e, j, 0, a[d + 8 >> 0] | 0) | 0;
                    i = m;
                    return r | 0
                } else {
                    r = xd(f, d + 4 | 0, h, c[n >> 2] | 0, k, g, e, j, 1, a[d + 9 >> 0] | 0) | 0;
                    i = m;
                    return r | 0
                }
            } else {
                r = 0;
                i = m;
                return r | 0
            }
            return 0
        }

        function Ra(a) {
            a = a | 0;
            var b = 0;
            b = i;
            i = i + a | 0;
            i = i + 15 & -16;
            return b | 0
        }

        function Sa() {
            return i | 0
        }

        function Ta(a) {
            a = a | 0;
            i = a
        }

        function Ua(a, b) {
            a = a | 0;
            b = b | 0;
            if (!o) {
                o = a;
                p = b
            }
        }

        function Va(b) {
            b = b | 0;
            a[k >> 0] = a[b >> 0];
            a[k + 1 >> 0] = a[b + 1 >> 0];
            a[k + 2 >> 0] = a[b + 2 >> 0];
            a[k + 3 >> 0] = a[b + 3 >> 0]
        }

        function Wa(b) {
            b = b | 0;
            a[k >> 0] = a[b >> 0];
            a[k + 1 >> 0] = a[b + 1 >> 0];
            a[k + 2 >> 0] = a[b + 2 >> 0];
            a[k + 3 >> 0] = a[b + 3 >> 0];
            a[k + 4 >> 0] = a[b + 4 >> 0];
            a[k + 5 >> 0] = a[b + 5 >> 0];
            a[k + 6 >> 0] = a[b + 6 >> 0];
            a[k + 7 >> 0] = a[b + 7 >> 0]
        }

        function Xa(a) {
            a = a | 0;
            D = a
        }

        function Ya() {
            return D | 0
        }

        function Za(b, d) {
            b = b | 0;
            d = d | 0;
            var e = 0,
                f = 0;
            e = i;
            if (!(a[(c[b + 204 >> 2] | 0) + 43 >> 0] | 0)) {
                i = e;
                return
            }
            f = c[(c[b + 200 >> 2] | 0) + 13128 >> 2] | 0;
            d = (d | 0) % (f | 0) | 0;
            if ((d | 0) != 2 ? !((f | 0) == 2 & (d | 0) == 0) : 0) {
                i = e;
                return
            }
            mf(c[b + 152 >> 2] | 0, c[b + 136 >> 2] | 0, 199) | 0;
            i = e;
            return
        }

        function _a(b, d) {
            b = b | 0;
            d = d | 0;
            var e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0;
            e = i;
            g = b + 204 | 0;
            f = c[g >> 2] | 0;
            if ((c[(c[f + 1668 >> 2] | 0) + (c[b + 3488 >> 2] << 2) >> 2] | 0) == (d | 0)) {
                $a(b);
                f = b + 2437 | 0;
                if (a[f >> 0] | 0) {
                    j = c[g >> 2] | 0;
                    if ((a[j + 42 >> 0] | 0) != 0 ? (j = c[j + 1676 >> 2] | 0, (c[j + (d << 2) >> 2] | 0) != (c[j + (d + -1 << 2) >> 2] | 0)) : 0) h = 5
                } else h = 5;
                if ((h | 0) == 5) ab(b);
                if (a[b + 2436 >> 0] | 0) {
                    i = e;
                    return
                }
                if (!(a[(c[g >> 2] | 0) + 43 >> 0] | 0)) {
                    i = e;
                    return
                }
                g = c[(c[b + 200 >> 2] | 0) + 13128 >> 2] | 0;
                if ((d | 0) % (g | 0) | 0) {
                    i = e;
                    return
                }
                if ((g | 0) == 1) {
                    ab(b);
                    i = e;
                    return
                }
                if ((a[f >> 0] | 0) != 1) {
                    i = e;
                    return
                }
                mf(c[b + 136 >> 2] | 0, c[b + 152 >> 2] | 0, 199) | 0;
                i = e;
                return
            }
            if ((a[f + 42 >> 0] | 0) != 0 ? (j = c[f + 1676 >> 2] | 0, (c[j + (d << 2) >> 2] | 0) != (c[j + (d + -1 << 2) >> 2] | 0)) : 0) {
                if ((a[b + 141 >> 0] | 0) == 1) bb(c[b + 136 >> 2] | 0);
                else $a(b);
                ab(b);
                f = c[g >> 2] | 0
            }
            if (!(a[f + 43 >> 0] | 0)) {
                i = e;
                return
            }
            f = b + 200 | 0;
            if ((d | 0) % (c[(c[f >> 2] | 0) + 13128 >> 2] | 0) | 0) {
                i = e;
                return
            }
            d = b + 136 | 0;
            cb((c[d >> 2] | 0) + 224 | 0) | 0;
            if ((a[b + 141 >> 0] | 0) == 1) bb(c[d >> 2] | 0);
            else $a(b);
            if ((c[(c[f >> 2] | 0) + 13128 >> 2] | 0) == 1) {
                ab(b);
                i = e;
                return
            } else {
                mf(c[d >> 2] | 0, c[b + 152 >> 2] | 0, 199) | 0;
                i = e;
                return
            }
        }

        function $a(a) {
            a = a | 0;
            var b = 0,
                d = 0,
                e = 0,
                f = 0,
                g = 0,
                h = 0;
            b = i;
            e = a + 136 | 0;
            a = c[e >> 2] | 0;
            d = a + 204 | 0;
            Zd(d, 1);
            g = a + 212 | 0;
            f = c[g >> 2] | 0;
            h = 0 - f & 7;
            if (h) {
                Zd(d, h);
                f = c[g >> 2] | 0
            }
            Vd((c[e >> 2] | 0) + 224 | 0, (c[d >> 2] | 0) + ((f | 0) / 8 | 0) | 0, (7 - f + (c[a + 216 >> 2] | 0) | 0) / 8 | 0);
            i = b;
            return
        }

        function ab(b) {
            b = b | 0;
            var e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0;
            g = i;
            f = c[b + 2428 >> 2] | 0;
            e = 2 - f | 0;
            e = (a[b + 3048 >> 0] | 0) == 0 | (f | 0) == 2 ? e : e ^ 3;
            f = b + 3100 | 0;
            b = b + 136 | 0;
            h = 0;
            do {
                j = d[680 + (e * 199 | 0) + h >> 0] | 0;
                l = a[f >> 0] | 0;
                k = l << 24 >> 24;
                if (l << 24 >> 24 < 0) k = 0;
                else k = (k | 0) > 51 ? 51 : k;
                j = ((j << 3 & 120) + -16 + (($(k, ((j >>> 4) * 5 | 0) + -45 | 0) | 0) >> 4) << 1) + -127 | 0;
                j = j >> 31 ^ j;
                if ((j | 0) > 124) j = j & 1 | 124;
                a[(c[b >> 2] | 0) + h >> 0] = j;
                h = h + 1 | 0
            } while ((h | 0) != 199);
            a[(c[b >> 2] | 0) + 199 >> 0] = 0;
            a[(c[b >> 2] | 0) + 200 >> 0] = 0;
            a[(c[b >> 2] | 0) + 201 >> 0] = 0;
            a[(c[b >> 2] | 0) + 202 >> 0] = 0;
            i = g;
            return
        }

        function bb(a) {
            a = a | 0;
            var b = 0,
                d = 0,
                e = 0,
                f = 0;
            b = i;
            d = a + 224 | 0;
            e = c[a + 240 >> 2] | 0;
            f = c[d >> 2] | 0;
            e = (f & 1 | 0) == 0 ? e : e + -1 | 0;
            e = (f & 511 | 0) == 0 ? e : e + -1 | 0;
            a = (c[a + 244 >> 2] | 0) - e | 0;
            if ((a | 0) < 0) {
                i = b;
                return
            }
            Vd(d, e, a);
            i = b;
            return
        }

        function cb(a) {
            a = a | 0;
            var b = 0,
                d = 0,
                e = 0,
                f = 0,
                g = 0;
            b = i;
            f = a + 4 | 0;
            d = c[f >> 2] | 0;
            e = d + -2 | 0;
            c[f >> 2] = e;
            g = c[a >> 2] | 0;
            if ((g | 0) >= (e << 17 | 0)) {
                g = (c[a + 16 >> 2] | 0) - (c[a + 12 >> 2] | 0) | 0;
                i = b;
                return g | 0
            }
            d = (d + -258 | 0) >>> 31;
            c[f >> 2] = e << d;
            g = g << d;
            c[a >> 2] = g;
            if (g & 65535) {
                g = 0;
                i = b;
                return g | 0
            }
            Nb(a);
            g = 0;
            i = b;
            return g | 0
        }

        function db(a) {
            a = a | 0;
            var b = 0;
            b = i;
            a = c[a + 136 >> 2] | 0;
            a = eb(a + 224 | 0, a) | 0;
            i = b;
            return a | 0
        }

        function eb(b, e) {
            b = b | 0;
            e = e | 0;
            var f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0;
            f = i;
            h = d[e >> 0] | 0;
            j = b + 4 | 0;
            k = c[j >> 2] | 0;
            l = d[3072 + ((k << 1 & 384) + (h | 512)) >> 0] | 0;
            k = k - l | 0;
            m = k << 17;
            n = c[b >> 2] | 0;
            g = m - n >> 31;
            c[b >> 2] = n - (g & m);
            c[j >> 2] = (g & l - k) + k;
            h = g ^ h;
            a[e >> 0] = a[h + 4224 >> 0] | 0;
            e = h & 1;
            h = c[j >> 2] | 0;
            g = d[3072 + h >> 0] | 0;
            c[j >> 2] = h << g;
            g = c[b >> 2] << g;
            c[b >> 2] = g;
            if (g & 65535) {
                i = f;
                return e | 0
            }
            j = b + 16 | 0;
            h = c[j >> 2] | 0;
            c[b >> 2] = (((d[h + 1 >> 0] | 0) << 1 | (d[h >> 0] | 0) << 9) + -65535 << 7 - (d[3072 + ((g + -1 ^ g) >> 15) >> 0] | 0)) + g;
            if (h >>> 0 >= (c[b + 20 >> 2] | 0) >>> 0) {
                i = f;
                return e | 0
            }
            c[j >> 2] = h + 2;
            i = f;
            return e | 0
        }

        function fb(a) {
            a = a | 0;
            var b = 0,
                d = 0;
            b = i;
            a = a + 136 | 0;
            d = c[a >> 2] | 0;
            if (!(eb(d + 224 | 0, d + 1 | 0) | 0)) {
                d = 0;
                i = b;
                return d | 0
            }
            d = (gb((c[a >> 2] | 0) + 224 | 0) | 0) == 0;
            d = d ? 1 : 2;
            i = b;
            return d | 0
        }

        function gb(a) {
            a = a | 0;
            var b = 0,
                d = 0,
                e = 0;
            b = i;
            d = c[a >> 2] << 1;
            c[a >> 2] = d;
            if (!(d & 65534)) {
                Nb(a);
                d = c[a >> 2] | 0
            }
            e = c[a + 4 >> 2] << 17;
            if ((d | 0) < (e | 0)) {
                e = 0;
                i = b;
                return e | 0
            }
            c[a >> 2] = d - e;
            e = 1;
            i = b;
            return e | 0
        }

        function hb(a) {
            a = a | 0;
            var b = 0,
                d = 0;
            b = i;
            d = a + 136 | 0;
            a = (gb((c[d >> 2] | 0) + 224 | 0) | 0) << 1;
            a = (gb((c[d >> 2] | 0) + 224 | 0) | 0 | a) << 1;
            a = (gb((c[d >> 2] | 0) + 224 | 0) | 0 | a) << 1;
            a = (gb((c[d >> 2] | 0) + 224 | 0) | 0 | a) << 1;
            a = gb((c[d >> 2] | 0) + 224 | 0) | 0 | a;
            i = b;
            return a | 0
        }

        function ib(a) {
            a = a | 0;
            var b = 0,
                d = 0,
                e = 0,
                f = 0;
            b = i;
            d = c[(c[a + 200 >> 2] | 0) + 52 >> 2] | 0;
            d = (d | 0) > 10 ? 31 : (1 << d + -5) + -1 | 0;
            e = a + 136 | 0;
            if ((d | 0) > 0) a = 0;
            else {
                f = 0;
                i = b;
                return f | 0
            }
            while (1) {
                f = a + 1 | 0;
                if (!(gb((c[e >> 2] | 0) + 224 | 0) | 0)) {
                    d = 4;
                    break
                }
                if ((f | 0) < (d | 0)) a = f;
                else {
                    a = f;
                    d = 4;
                    break
                }
            }
            if ((d | 0) == 4) {
                i = b;
                return a | 0
            }
            return 0
        }

        function jb(a) {
            a = a | 0;
            var b = 0;
            b = i;
            a = gb((c[a + 136 >> 2] | 0) + 224 | 0) | 0;
            i = b;
            return a | 0
        }

        function kb(a) {
            a = a | 0;
            var b = 0,
                d = 0;
            b = i;
            d = a + 136 | 0;
            a = (gb((c[d >> 2] | 0) + 224 | 0) | 0) << 1;
            a = gb((c[d >> 2] | 0) + 224 | 0) | 0 | a;
            i = b;
            return a | 0
        }

        function lb(a) {
            a = a | 0;
            var b = 0;
            b = i;
            a = cb((c[a + 136 >> 2] | 0) + 224 | 0) | 0;
            i = b;
            return a | 0
        }

        function mb(a) {
            a = a | 0;
            var b = 0;
            b = i;
            a = c[a + 136 >> 2] | 0;
            a = eb(a + 224 | 0, a + 5 | 0) | 0;
            i = b;
            return a | 0
        }

        function nb(b, d, e, f, g) {
            b = b | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            var h = 0,
                j = 0,
                k = 0,
                l = 0;
            h = i;
            l = c[b + 200 >> 2] | 0;
            j = c[l + 13140 >> 2] | 0;
            l = (1 << c[l + 13080 >> 2]) + -1 | 0;
            k = l & e;
            e = c[b + 136 >> 2] | 0;
            if ((a[e + 308 >> 0] | 0) == 0 ? (l & d | 0) == 0 : 0) d = 0;
            else {
                d = f + -1 + ($(j, g) | 0) | 0;
                d = (a[(c[b + 7584 >> 2] | 0) + d >> 0] | 0) != 0 & 1
            }
            if ((a[e + 309 >> 0] | 0) == 0 & (k | 0) == 0) {
                l = d;
                d = e + 224 | 0;
                l = l + 6 | 0;
                l = e + l | 0;
                l = eb(d, l) | 0;
                i = h;
                return l | 0
            }
            l = ($(j, g + -1 | 0) | 0) + f | 0;
            l = ((a[(c[b + 7584 >> 2] | 0) + l >> 0] | 0) != 0 & 1) + d | 0;
            d = e + 224 | 0;
            l = l + 6 | 0;
            l = e + l | 0;
            l = eb(d, l) | 0;
            i = h;
            return l | 0
        }

        function ob(a) {
            a = a | 0;
            var b = 0,
                d = 0,
                e = 0,
                f = 0,
                g = 0,
                h = 0;
            b = i;
            a = a + 136 | 0;
            g = 9;
            e = 0;
            while (1) {
                h = c[a >> 2] | 0;
                f = e;
                e = e + 1 | 0;
                if (!(eb(h + 224 | 0, h + g | 0) | 0)) {
                    e = f;
                    g = 0;
                    break
                }
                if ((e | 0) >= 5) {
                    f = 0;
                    g = 0;
                    d = 4;
                    break
                } else g = 10
            }
            do
                if ((d | 0) == 4) {
                    while (1) {
                        d = 0;
                        if (!(gb((c[a >> 2] | 0) + 224 | 0) | 0)) {
                            d = 5;
                            break
                        }
                        g = (1 << f) + g | 0;
                        f = f + 1 | 0;
                        if ((f | 0) < 31) d = 4;
                        else break
                    }
                    if ((d | 0) == 5)
                        if (!f) break;
                    do {
                        f = f + -1 | 0;
                        g = ((gb((c[a >> 2] | 0) + 224 | 0) | 0) << f) + g | 0
                    } while ((f | 0) != 0)
                }
            while (0);
            i = b;
            return g + e | 0
        }

        function pb(a) {
            a = a | 0;
            var b = 0;
            b = i;
            a = gb((c[a + 136 >> 2] | 0) + 224 | 0) | 0;
            i = b;
            return a | 0
        }

        function qb(a) {
            a = a | 0;
            var b = 0;
            b = i;
            a = c[a + 136 >> 2] | 0;
            a = eb(a + 224 | 0, a + 176 | 0) | 0;
            i = b;
            return a | 0
        }

        function rb(b) {
            b = b | 0;
            var d = 0,
                e = 0,
                f = 0,
                g = 0,
                h = 0;
            d = i;
            e = a[(c[b + 204 >> 2] | 0) + 1633 >> 0] | 0;
            e = (e & 255) < 5 ? 5 : e & 255;
            f = b + 136 | 0;
            if (!e) {
                g = 0;
                i = d;
                return g | 0
            } else b = 0;
            while (1) {
                h = c[f >> 2] | 0;
                g = b + 1 | 0;
                if (!(eb(h + 224 | 0, h + 177 | 0) | 0)) {
                    e = 4;
                    break
                }
                if ((g | 0) < (e | 0)) b = g;
                else {
                    b = g;
                    e = 4;
                    break
                }
            }
            if ((e | 0) == 4) {
                i = d;
                return b | 0
            }
            return 0
        }

        function sb(a) {
            a = a | 0;
            var b = 0;
            b = i;
            a = c[a + 136 >> 2] | 0;
            a = eb(a + 224 | 0, a + 12 | 0) | 0;
            i = b;
            return a | 0
        }

        function tb(b, e, f, g) {
            b = b | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            var h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0;
            j = i;
            k = c[b + 200 >> 2] | 0;
            n = (1 << c[k + 13080 >> 2]) + -1 | 0;
            l = n & g;
            m = c[k + 13064 >> 2] | 0;
            h = f >> m;
            m = g >> m;
            g = c[b + 136 >> 2] | 0;
            if ((a[g + 308 >> 0] | 0) == 0 ? (n & f | 0) == 0 : 0) f = 0;
            else {
                f = h + -1 + ($(c[k + 13140 >> 2] | 0, m) | 0) | 0;
                f = d[(c[b + 7588 >> 2] | 0) + f >> 0] | 0
            }
            if ((a[g + 309 >> 0] | 0) == 0 & (l | 0) == 0) {
                n = 0;
                m = (f | 0) > (e | 0);
                m = m & 1;
                n = (n | 0) > (e | 0);
                n = n & 1;
                f = g + 224 | 0;
                m = m | 2;
                n = m + n | 0;
                n = g + n | 0;
                n = eb(f, n) | 0;
                i = j;
                return n | 0
            }
            n = ($(c[k + 13140 >> 2] | 0, m + -1 | 0) | 0) + h | 0;
            n = d[(c[b + 7588 >> 2] | 0) + n >> 0] | 0;
            m = (f | 0) > (e | 0);
            m = m & 1;
            n = (n | 0) > (e | 0);
            n = n & 1;
            f = g + 224 | 0;
            m = m | 2;
            n = m + n | 0;
            n = g + n | 0;
            n = eb(f, n) | 0;
            i = j;
            return n | 0
        }

        function ub(b, d) {
            b = b | 0;
            d = d | 0;
            var e = 0,
                f = 0,
                g = 0;
            e = i;
            f = b + 136 | 0;
            g = c[f >> 2] | 0;
            do
                if (!(eb(g + 224 | 0, g + 13 | 0) | 0)) {
                    b = c[b + 200 >> 2] | 0;
                    if ((c[b + 13064 >> 2] | 0) == (d | 0)) {
                        b = c[f >> 2] | 0;
                        if ((c[b + 31244 >> 2] | 0) == 1) {
                            f = 3;
                            break
                        }
                        if (eb(b + 224 | 0, b + 14 | 0) | 0) {
                            f = 1;
                            break
                        }
                        if ((d | 0) == 3) {
                            f = 2;
                            break
                        }
                        f = c[f >> 2] | 0;
                        f = (eb(f + 224 | 0, f + 15 | 0) | 0) == 0;
                        f = f ? 3 : 2;
                        break
                    }
                    g = (a[b + 12940 >> 0] | 0) == 0;
                    d = c[f >> 2] | 0;
                    d = (eb(d + 224 | 0, d + 14 | 0) | 0) != 0;
                    if (g) {
                        f = d ? 1 : 2;
                        break
                    }
                    b = c[f >> 2] | 0;
                    b = (eb(b + 224 | 0, b + 16 | 0) | 0) != 0;
                    if (d) {
                        if (b) {
                            f = 1;
                            break
                        }
                        f = (gb((c[f >> 2] | 0) + 224 | 0) | 0) == 0;
                        f = f ? 4 : 5;
                        break
                    } else {
                        if (b) {
                            f = 2;
                            break
                        }
                        f = (gb((c[f >> 2] | 0) + 224 | 0) | 0) == 0;
                        f = f ? 6 : 7;
                        break
                    }
                } else f = 0;
            while (0);
            i = e;
            return f | 0
        }

        function vb(a) {
            a = a | 0;
            var b = 0;
            b = i;
            a = cb((c[a + 136 >> 2] | 0) + 224 | 0) | 0;
            i = b;
            return a | 0
        }

        function wb(a) {
            a = a | 0;
            var b = 0;
            b = i;
            a = c[a + 136 >> 2] | 0;
            a = eb(a + 224 | 0, a + 17 | 0) | 0;
            i = b;
            return a | 0
        }

        function xb(a) {
            a = a | 0;
            var b = 0,
                d = 0,
                e = 0;
            b = i;
            e = a + 136 | 0;
            d = 0;
            while (1) {
                a = d + 1 | 0;
                if (!(gb((c[e >> 2] | 0) + 224 | 0) | 0)) {
                    a = d;
                    d = 4;
                    break
                }
                if ((a | 0) < 2) d = a;
                else {
                    d = 4;
                    break
                }
            }
            if ((d | 0) == 4) {
                i = b;
                return a | 0
            }
            return 0
        }

        function yb(a) {
            a = a | 0;
            var b = 0,
                d = 0;
            b = i;
            d = a + 136 | 0;
            a = (gb((c[d >> 2] | 0) + 224 | 0) | 0) << 1;
            a = (gb((c[d >> 2] | 0) + 224 | 0) | 0 | a) << 1;
            a = (gb((c[d >> 2] | 0) + 224 | 0) | 0 | a) << 1;
            a = (gb((c[d >> 2] | 0) + 224 | 0) | 0 | a) << 1;
            a = gb((c[d >> 2] | 0) + 224 | 0) | 0 | a;
            i = b;
            return a | 0
        }

        function zb(a) {
            a = a | 0;
            var b = 0,
                d = 0;
            b = i;
            a = a + 136 | 0;
            d = c[a >> 2] | 0;
            if (!(eb(d + 224 | 0, d + 18 | 0) | 0)) {
                d = 4;
                i = b;
                return d | 0
            }
            d = (gb((c[a >> 2] | 0) + 224 | 0) | 0) << 1;
            d = gb((c[a >> 2] | 0) + 224 | 0) | 0 | d;
            i = b;
            return d | 0
        }

        function Ab(a) {
            a = a | 0;
            var b = 0,
                d = 0,
                e = 0,
                f = 0;
            b = i;
            d = a + 136 | 0;
            e = c[d >> 2] | 0;
            e = eb(e + 224 | 0, e + 21 | 0) | 0;
            if (!e) {
                f = 0;
                i = b;
                return f | 0
            }
            a = a + 3080 | 0;
            if (e >>> 0 >= ((c[a >> 2] | 0) + -1 | 0) >>> 0) {
                f = e;
                i = b;
                return f | 0
            }
            while (1) {
                f = e + 1 | 0;
                if (!(gb((c[d >> 2] | 0) + 224 | 0) | 0)) {
                    d = 5;
                    break
                }
                if (f >>> 0 < ((c[a >> 2] | 0) + -1 | 0) >>> 0) e = f;
                else {
                    e = f;
                    d = 5;
                    break
                }
            }
            if ((d | 0) == 5) {
                i = b;
                return e | 0
            }
            return 0
        }

        function Bb(a) {
            a = a | 0;
            var b = 0;
            b = i;
            a = c[a + 136 >> 2] | 0;
            a = eb(a + 224 | 0, a + 20 | 0) | 0;
            i = b;
            return a | 0
        }

        function Cb(a, b, d) {
            a = a | 0;
            b = b | 0;
            d = d | 0;
            var e = 0,
                f = 0,
                g = 0;
            e = i;
            g = a + 136 | 0;
            a = c[g >> 2] | 0;
            f = a + 224 | 0;
            if ((d + b | 0) == 12) {
                g = eb(f, a + 26 | 0) | 0;
                i = e;
                return g | 0
            }
            if (eb(f, a + ((c[a + 31232 >> 2] | 0) + 22) | 0) | 0) {
                g = 2;
                i = e;
                return g | 0
            }
            g = c[g >> 2] | 0;
            g = eb(g + 224 | 0, g + 26 | 0) | 0;
            i = e;
            return g | 0
        }

        function Db(a, b) {
            a = a | 0;
            b = b | 0;
            var d = 0,
                e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0;
            d = i;
            b = b + -1 | 0;
            e = (b | 0) > 2;
            f = e ? 2 : b;
            a = a + 136 | 0;
            if ((f | 0) > 0) h = 0;
            else {
                h = 0;
                i = d;
                return h | 0
            }
            while (1) {
                j = c[a >> 2] | 0;
                g = h + 1 | 0;
                if (!(eb(j + 224 | 0, j + (h + 27) | 0) | 0)) {
                    g = h;
                    break
                }
                if ((g | 0) < (f | 0)) h = g;
                else break
            }
            if ((g | 0) != 2 | e ^ 1) {
                j = g;
                i = d;
                return j | 0
            } else e = 2;
            while (1) {
                f = e + 1 | 0;
                if (!(gb((c[a >> 2] | 0) + 224 | 0) | 0)) {
                    b = 7;
                    break
                }
                if ((f | 0) < (b | 0)) e = f;
                else {
                    e = f;
                    b = 7;
                    break
                }
            }
            if ((b | 0) == 7) {
                i = d;
                return e | 0
            }
            return 0
        }

        function Eb(a) {
            a = a | 0;
            var b = 0;
            b = i;
            a = c[a + 136 >> 2] | 0;
            a = eb(a + 224 | 0, a + 35 | 0) | 0;
            i = b;
            return a | 0
        }

        function Fb(a) {
            a = a | 0;
            var b = 0;
            b = i;
            a = c[a + 136 >> 2] | 0;
            a = eb(a + 224 | 0, a + 36 | 0) | 0;
            i = b;
            return a | 0
        }

        function Gb(a, b) {
            a = a | 0;
            b = b | 0;
            var d = 0;
            d = i;
            a = c[a + 136 >> 2] | 0;
            a = eb(a + 224 | 0, a + (42 - b) | 0) | 0;
            i = d;
            return a | 0
        }

        function Hb(a, b) {
            a = a | 0;
            b = b | 0;
            var d = 0;
            d = i;
            a = c[a + 136 >> 2] | 0;
            a = eb(a + 224 | 0, a + (b + 42) | 0) | 0;
            i = d;
            return a | 0
        }

        function Ib(a, b) {
            a = a | 0;
            b = b | 0;
            var d = 0;
            d = i;
            a = c[a + 136 >> 2] | 0;
            a = eb(a + 224 | 0, a + ((b | 0) == 0 | 40) | 0) | 0;
            i = d;
            return a | 0
        }

        function Jb(a, b) {
            a = a | 0;
            b = b | 0;
            var d = 0,
                e = 0,
                f = 0,
                g = 0;
            d = i;
            a = a + 136 | 0;
            f = (b << 2) + 166 | 0;
            e = 0;
            while (1) {
                g = c[a >> 2] | 0;
                b = e + 1 | 0;
                if (!(eb(g + 224 | 0, g + (f + e) | 0) | 0)) {
                    b = e;
                    a = 4;
                    break
                }
                if ((b | 0) < 4) e = b;
                else {
                    a = 4;
                    break
                }
            }
            if ((a | 0) == 4) {
                i = d;
                return b | 0
            }
            return 0
        }

        function Kb(a, b) {
            a = a | 0;
            b = b | 0;
            var d = 0;
            d = i;
            a = c[a + 136 >> 2] | 0;
            a = eb(a + 224 | 0, a + (b + 174) | 0) | 0;
            i = d;
            return a | 0
        }

        function Lb(f, g, h, j, k, l) {
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            var m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                E = 0,
                F = 0,
                G = 0,
                H = 0,
                I = 0,
                J = 0,
                K = 0,
                L = 0,
                M = 0,
                N = 0,
                O = 0,
                P = 0,
                Q = 0,
                R = 0,
                S = 0,
                T = 0,
                U = 0,
                V = 0,
                W = 0,
                X = 0,
                Y = 0,
                Z = 0,
                _ = 0,
                aa = 0,
                ba = 0,
                ca = 0,
                da = 0,
                ea = 0,
                fa = 0,
                ga = 0,
                ha = 0,
                ia = 0,
                ja = 0,
                ka = 0,
                la = 0,
                ma = 0,
                na = 0,
                oa = 0,
                pa = 0,
                qa = 0,
                ra = 0,
                sa = 0,
                ta = 0,
                ua = 0,
                va = 0,
                wa = 0,
                xa = 0,
                ya = 0,
                za = 0,
                Aa = 0,
                Ba = 0,
                Ca = 0,
                Da = 0,
                Ga = 0,
                Ha = 0,
                Ia = 0,
                Ja = 0,
                La = 0,
                Ma = 0,
                Na = 0,
                Oa = 0,
                Pa = 0,
                Qa = 0;
            m = i;
            i = i + 96 | 0;
            w = m + 24 | 0;
            t = m + 8 | 0;
            v = m;
            s = f + 136 | 0;
            p = c[s >> 2] | 0;
            x = c[f + 160 >> 2] | 0;
            n = c[x + (l << 2) + 32 >> 2] | 0;
            r = f + 200 | 0;
            o = c[r >> 2] | 0;
            W = $(h >> c[o + (l << 2) + 13180 >> 2], n) | 0;
            o = (c[x + (l << 2) >> 2] | 0) + (W + (g >> c[o + (l << 2) + 13168 >> 2] << c[o + 56 >> 2])) | 0;
            W = (l | 0) != 0;
            g = p + 320 | 0;
            h = W ? p + 11680 | 0 : g;
            x = w + 0 | 0;
            q = x + 64 | 0;
            do {
                a[x >> 0] = 0;
                x = x + 1 | 0
            } while ((x | 0) < (q | 0));
            V = 1 << j;
            y = (l | 0) == 0;
            x = c[(y ? p + 288 | 0 : p + 292 | 0) >> 2] | 0;
            q = V << j;
            jf(h | 0, 0, q << 1 | 0) | 0;
            z = p + 31256 | 0;
            if (!(a[z >> 0] | 0)) {
                A = a[p + 272 >> 0] | 0;
                C = f + 204 | 0;
                Pa = c[C >> 2] | 0;
                if ((a[Pa + 21 >> 0] | 0) != 0 ? (d[Pa + 1629 >> 0] | 0) >= (j | 0) : 0) {
                    I = c[s >> 2] | 0;
                    I = eb(I + 224 | 0, I + (W & 1 | 46) | 0) | 0
                } else I = 0;
                if (y) {
                    B = c[r >> 2] | 0;
                    E = B;
                    B = (c[B + 13192 >> 2] | 0) + A | 0
                } else {
                    B = c[C >> 2] | 0;
                    if ((l | 0) == 1) B = (c[f + 3060 >> 2] | 0) + (c[B + 28 >> 2] | 0) + (a[p + 302 >> 0] | 0) | 0;
                    else B = (c[f + 3064 >> 2] | 0) + (c[B + 32 >> 2] | 0) + (a[p + 303 >> 0] | 0) | 0;
                    B = B + A | 0;
                    E = c[r >> 2] | 0;
                    A = c[E + 13192 >> 2] | 0;
                    F = 0 - A | 0;
                    if ((B | 0) < (F | 0)) B = F;
                    else B = (B | 0) > 57 ? 57 : B;
                    do
                        if ((c[E + 4 >> 2] | 0) == 1) {
                            if ((B | 0) >= 30)
                                if ((B | 0) > 43) {
                                    B = B + -6 | 0;
                                    break
                                } else {
                                    B = c[176 + (B + -30 << 2) >> 2] | 0;
                                    break
                                }
                        } else B = (B | 0) > 51 ? 51 : B;
                    while (0);
                    B = A + B | 0
                }
                A = (c[E + 52 >> 2] | 0) + j | 0;
                H = A + -5 | 0;
                A = 1 << A + -6;
                B = d[168 + (d[232 + B >> 0] | 0) >> 0] << d[312 + B >> 0];
                if ((a[E + 634 >> 0] | 0) != 0 ? !((I | 0) != 0 & (j | 0) > 2) : 0) {
                    F = c[C >> 2] | 0;
                    F = (a[F + 68 >> 0] | 0) == 0 ? E + 635 | 0 : F + 69 | 0;
                    C = ((c[p + 31244 >> 2] | 0) != 1 ? 3 : 0) + l | 0;
                    E = F + ((j + -2 | 0) * 384 | 0) + (C << 6) | 0;
                    if ((j | 0) > 3) la = a[F + ((j + -4 | 0) * 6 | 0) + C + 1536 >> 0] | 0;
                    else la = 16
                } else {
                    la = 16;
                    E = 0
                }
            } else {
                A = 0;
                la = 0;
                B = 0;
                E = 0;
                H = 0;
                I = 0
            }
            F = p + 31244 | 0;
            do
                if ((c[F >> 2] | 0) == 0 ? (c[(c[r >> 2] | 0) + 13108 >> 2] | 0) != 0 : 0) {
                    if ((I | 0) == 0 ? (a[z >> 0] | 0) == 0 : 0) {
                        C = 0;
                        G = 0;
                        break
                    }
                    G = c[s >> 2] | 0;
                    C = W & 1;
                    G = eb(G + 224 | 0, G + (C | 48) | 0) | 0;
                    if (G) {
                        Pa = c[s >> 2] | 0;
                        C = eb(Pa + 224 | 0, Pa + (C | 50) | 0) | 0
                    } else {
                        C = 0;
                        G = 0
                    }
                } else {
                    C = 0;
                    G = 0
                }
            while (0);
            L = (j << 1) + -1 | 0;
            if (y) {
                J = (j * 3 | 0) + -6 + (j + -1 >> 2) | 0;
                M = j + 1 >> 2
            } else {
                J = 15;
                M = j + -2 | 0
            }
            if ((L | 0) > 0) {
                O = J + 52 | 0;
                K = 0;
                while (1) {
                    Pa = c[s >> 2] | 0;
                    N = K + 1 | 0;
                    if (!(eb(Pa + 224 | 0, Pa + (O + (K >> M)) | 0) | 0)) break;
                    if ((N | 0) < (L | 0)) K = N;
                    else {
                        K = N;
                        break
                    }
                }
                N = J + 70 | 0;
                J = 0;
                while (1) {
                    Pa = c[s >> 2] | 0;
                    O = J + 1 | 0;
                    if (!(eb(Pa + 224 | 0, Pa + (N + (J >> M)) | 0) | 0)) break;
                    if ((O | 0) < (L | 0)) J = O;
                    else {
                        J = O;
                        break
                    }
                }
                if ((K | 0) > 3) {
                    L = (K >> 1) + -1 | 0;
                    N = gb((c[s >> 2] | 0) + 224 | 0) | 0;
                    if ((L | 0) > 1) {
                        M = 1;
                        do {
                            N = gb((c[s >> 2] | 0) + 224 | 0) | 0 | N << 1;
                            M = M + 1 | 0
                        } while ((M | 0) != (L | 0))
                    }
                    K = N + ((K & 1 | 2) << L) | 0
                }
                if ((J | 0) > 3) {
                    M = (J >> 1) + -1 | 0;
                    N = gb((c[s >> 2] | 0) + 224 | 0) | 0;
                    if ((M | 0) > 1) {
                        L = 1;
                        do {
                            N = gb((c[s >> 2] | 0) + 224 | 0) | 0 | N << 1;
                            L = L + 1 | 0
                        } while ((L | 0) != (M | 0))
                    }
                    L = K;
                    O = N + ((J & 1 | 2) << M) | 0
                } else {
                    L = K;
                    O = J
                }
            } else {
                L = 0;
                O = 0
            }
            do
                if ((k | 0) != 2) {
                    P = L >> 2;
                    Q = O >> 2;
                    if ((k | 0) == 1) {
                        J = L;
                        K = O;
                        S = d[536 + (O << 3) + L >> 0] | 0;
                        L = 488;
                        M = 504;
                        N = 496;
                        O = 520;
                        break
                    } else if (k) {
                        N = L;
                        M = O;
                        u = 55;
                        break
                    }
                    S = d[(L & 3) + (392 + ((O & 3) << 2)) >> 0] | 0;
                    if ((V | 0) == 8) {
                        J = L;
                        K = O;
                        S = (d[416 + (Q << 1) + P >> 0] << 4) + S | 0;
                        L = 496;
                        M = 8;
                        N = 488;
                        O = 24;
                        break
                    } else if ((V | 0) == 16) {
                        J = L;
                        K = O;
                        S = (d[392 + (Q << 2) + P >> 0] << 4) + S | 0;
                        L = 8;
                        M = 8;
                        N = 24;
                        O = 24;
                        break
                    } else if ((V | 0) == 4) {
                        J = L;
                        K = O;
                        L = 408;
                        M = 8;
                        N = 408;
                        O = 24;
                        break
                    } else {
                        J = L;
                        K = O;
                        S = (d[424 + (Q << 3) + P >> 0] << 4) + S | 0;
                        L = 40;
                        M = 8;
                        N = 104;
                        O = 24;
                        break
                    }
                } else {
                    N = O;
                    M = L;
                    P = O >> 2;
                    Q = L >> 2;
                    u = 55
                }
            while (0);
            if ((u | 0) == 55) {
                J = N;
                K = M;
                S = d[536 + (N << 3) + M >> 0] | 0;
                L = 496;
                M = 520;
                N = 488;
                O = 504
            }
            R = S + 1 | 0;
            T = S >> 4;
            if ((T | 0) > -1) {
                S = (1 << j + -2) + -1 | 0;
                U = (l | 0) > 0;
                l = U ? 90 : 88;
                V = V + -1 >> 2;
                W = W ? 27 : 0;
                Z = (j | 0) == 2;
                Y = W + 3 | 0;
                X = (j | 0) == 3;
                k = (k | 0) == 0 ? 9 : 15;
                ja = y ? 0 : 27;
                ga = (I | 0) == 0;
                da = y ? 42 : 43;
                aa = y ? 40 : 41;
                ea = y ? 2 : 0;
                ia = (G | 0) == 0;
                ha = (x & -17 | 0) != 10 & ia;
                ka = f + 204 | 0;
                ca = ((B | 0) < 0) << 31 >> 31;
                ba = ((A | 0) < 0) << 31 >> 31;
                _ = (I | 0) != 0 & (j | 0) > 2;
                fa = (j | 0) < 4;
                pa = la & 255;
                ma = (y & 1) << 1;
                la = ma | 1;
                ta = 1;
                oa = T;
                ra = 0;
                Aa = 16;
                while (1) {
                    qa = oa << 4;
                    za = a[L + oa >> 0] | 0;
                    wa = za & 255;
                    ya = a[N + oa >> 0] | 0;
                    xa = ya & 255;
                    na = (oa | 0) > 0;
                    if ((oa | 0) < (T | 0) & na) {
                        if ((wa | 0) < (S | 0)) sa = d[w + (wa + 1 << 3) + xa >> 0] | 0;
                        else sa = 0;
                        if ((xa | 0) < (S | 0)) sa = (d[xa + 1 + (w + (wa << 3)) >> 0] | 0) + sa | 0;
                        Ba = c[s >> 2] | 0;
                        Ba = (eb(Ba + 224 | 0, Ba + (((sa | 0) > 1 ? 1 : sa) + l) | 0) | 0) & 255;
                        a[w + (wa << 3) + xa >> 0] = Ba;
                        ua = 1
                    } else {
                        if (!((wa | 0) == (P | 0) & (xa | 0) == (Q | 0)))
                            if (!(za << 24 >> 24)) Ba = ya << 24 >> 24 == 0 & 1;
                            else Ba = 0;
                        else Ba = 1;
                        a[w + (wa << 3) + xa >> 0] = Ba;
                        ua = 0
                    }
                    qa = R - qa | 0;
                    sa = (oa | 0) == (T | 0);
                    if (sa) {
                        a[t >> 0] = qa + 255;
                        va = qa + -2 | 0;
                        qa = 1
                    } else {
                        va = 15;
                        qa = 0
                    }
                    if ((wa | 0) < (V | 0)) Ca = (a[w + (wa + 1 << 3) + xa >> 0] | 0) != 0 & 1;
                    else Ca = 0;
                    if ((xa | 0) < (V | 0)) Ca = ((a[xa + 1 + (w + (wa << 3)) >> 0] | 0) != 0 & 1) << 1 | Ca;
                    do
                        if (Ba << 24 >> 24 != 0 & (va | 0) > -1) {
                            if (!(c[(c[r >> 2] | 0) + 13100 >> 2] | 0))
                                if (Z) {
                                    ya = 600;
                                    za = W
                                } else u = 79;
                            else if (ga) {
                                Ba = (a[z >> 0] | 0) != 0;
                                if (Ba | Z) {
                                    ya = Ba ? 664 : 600;
                                    za = Ba ? aa : W
                                } else u = 79
                            } else {
                                ya = 664;
                                za = aa
                            }
                            do
                                if ((u | 0) == 79) {
                                    u = 0;
                                    Ba = (Ca << 4) + 616 | 0;
                                    if (!y) {
                                        ya = Ba;
                                        za = W + (X ? 9 : 12) | 0;
                                        break
                                    }
                                    za = (ya | za) << 24 >> 24 == 0 ? W : Y;
                                    if (X) {
                                        ya = Ba;
                                        za = za + k | 0;
                                        break
                                    } else {
                                        ya = Ba;
                                        za = za + 21 | 0;
                                        break
                                    }
                                }
                            while (0);
                            if ((va | 0) > 0) {
                                Ba = za + 92 | 0;
                                do {
                                    Pa = c[s >> 2] | 0;
                                    if (eb(Pa + 224 | 0, Pa + (Ba + (d[ya + ((d[O + va >> 0] << 2) + (d[M + va >> 0] | 0)) >> 0] | 0)) | 0) | 0) {
                                        a[t + (qa & 255) >> 0] = va;
                                        ua = 0;
                                        qa = qa + 1 << 24 >> 24
                                    }
                                    va = va + -1 | 0
                                } while ((va | 0) > 0)
                            }
                            if (ua) {
                                a[t + (qa & 255) >> 0] = 0;
                                ua = qa + 1 << 24 >> 24;
                                break
                            }
                            if (c[(c[r >> 2] | 0) + 13100 >> 2] | 0)
                                if (ga ? (a[z >> 0] | 0) == 0 : 0) u = 93;
                                else ua = da;
                            else u = 93;
                            if ((u | 0) == 93) {
                                u = 0;
                                ua = (oa | 0) == 0 ? ja : za + 2 | 0
                            }
                            Pa = c[s >> 2] | 0;
                            if ((eb(Pa + 224 | 0, Pa + (ua + 92) | 0) | 0) == 1) {
                                a[t + (qa & 255) >> 0] = 0;
                                ua = qa + 1 << 24 >> 24
                            } else ua = qa
                        } else ua = qa;
                    while (0);
                    qa = ua & 255;
                    a: do
                        if (ua << 24 >> 24) {
                            ua = na ? ea : 0;
                            if (!(c[(c[r >> 2] | 0) + 13116 >> 2] | 0)) Ia = 0;
                            else {
                                if (ga ? (a[z >> 0] | 0) == 0 : 0) ra = ma;
                                else ra = la;
                                Ia = (d[p + ra + 199 >> 0] | 0) >>> 2
                            }
                            va = ua | (ta | 0) == 0 & (sa ^ 1) & 1;
                            Ga = a[t >> 0] | 0;
                            ya = Ga & 255;
                            za = qa >>> 0 > 8 ? 8 : qa;
                            if (!za) {
                                sa = -1;
                                ta = 1
                            } else {
                                Ba = va << 2;
                                sa = -1;
                                ta = 1;
                                ua = 0;
                                do {
                                    Pa = ta + Ba | 0;
                                    Oa = c[s >> 2] | 0;
                                    Pa = (eb(Oa + 224 | 0, Oa + ((U ? Pa + 16 | 0 : Pa) + 136) | 0) | 0) & 255;
                                    a[v + ua >> 0] = Pa;
                                    if (!(Pa << 24 >> 24)) ta = ((ta + -1 | 0) >>> 0 < 2 & 1) + ta | 0;
                                    else {
                                        sa = (sa | 0) == -1 ? ua : sa;
                                        ta = 0
                                    }
                                    ua = ua + 1 | 0
                                } while ((ua | 0) < (za | 0))
                            }
                            za = qa + -1 | 0;
                            ua = a[t + za >> 0] | 0;
                            Ba = ua & 255;
                            b: do
                                if (!(a[z >> 0] | 0)) {
                                    do
                                        if ((c[F >> 2] | 0) == 1) {
                                            if ((c[(c[r >> 2] | 0) + 13104 >> 2] | 0) == 0 | ga) {
                                                u = 113;
                                                break
                                            }
                                            if (!ha) {
                                                ya = 0;
                                                break b
                                            }
                                        } else u = 113;
                                    while (0);
                                    if ((u | 0) == 113 ? (u = 0, !ia) : 0) {
                                        ya = 0;
                                        break
                                    }
                                    ya = (ya - Ba | 0) > 3 & 1
                                } else ya = 0;
                            while (0);
                            if ((sa | 0) != -1) {
                                Oa = c[s >> 2] | 0;
                                Oa = eb(Oa + 224 | 0, Oa + ((U ? va | 4 : va) | 160) | 0) | 0;
                                Pa = v + sa | 0;
                                a[Pa >> 0] = (d[Pa >> 0] | 0) + Oa
                            }
                            va = (ya | 0) == 0;
                            if ((a[(c[ka >> 2] | 0) + 4 >> 0] | 0) == 0 | va) {
                                za = 0;
                                ya = 0;
                                do {
                                    ya = gb((c[s >> 2] | 0) + 224 | 0) | 0 | ya << 1;
                                    za = za + 1 | 0
                                } while ((za | 0) < (qa | 0));
                                Ca = ya << 16 - qa
                            } else {
                                ya = za & 255;
                                if (!((za & 255) << 24 >> 24)) Ba = 0;
                                else {
                                    za = 0;
                                    Ba = 0;
                                    do {
                                        Ba = gb((c[s >> 2] | 0) + 224 | 0) | 0 | Ba << 1;
                                        za = za + 1 | 0
                                    } while ((za | 0) < (ya | 0))
                                }
                                Ca = Ba << 17 - qa
                            }
                            wa = wa << 2;
                            xa = xa << 2;
                            ya = p + ra + 199 | 0;
                            za = 0;
                            Ja = 0;
                            Da = Aa;
                            Ha = 0;
                            while (1) {
                                Aa = Ga & 255;
                                Ba = (d[M + Aa >> 0] | 0) + wa | 0;
                                Aa = (d[O + Aa >> 0] | 0) + xa | 0;
                                c: do
                                    if ((za | 0) < 8) {
                                        La = (d[v + za >> 0] | 0) + 1 | 0;
                                        Pa = (za | 0) == (sa | 0);
                                        if ((La | 0) == ((Pa ? 3 : 2) | 0) & 0 == ((Pa ? 0 : 0) | 0)) Ma = 0;
                                        else {
                                            Ma = 0;
                                            break
                                        }
                                        while (1) {
                                            Na = Ma + 1 | 0;
                                            if (!(gb((c[s >> 2] | 0) + 224 | 0) | 0)) {
                                                u = 128;
                                                break
                                            }
                                            if ((Na | 0) < 31) Ma = Na;
                                            else {
                                                u = 132;
                                                break
                                            }
                                        }
                                        do
                                            if ((u | 0) == 128) {
                                                u = 0;
                                                if ((Ma | 0) >= 3) {
                                                    Na = Ma;
                                                    u = 132;
                                                    break
                                                }
                                                if ((Ia | 0) > 0) {
                                                    Na = 0;
                                                    Oa = 0;
                                                    do {
                                                        Oa = gb((c[s >> 2] | 0) + 224 | 0) | 0 | Oa << 1;
                                                        Na = Na + 1 | 0
                                                    } while ((Na | 0) != (Ia | 0))
                                                } else Oa = 0;
                                                Na = Oa + (Ma << Ia) | 0
                                            }
                                        while (0);
                                        if ((u | 0) == 132) {
                                            u = 0;
                                            Ma = Na + -3 | 0;
                                            if ((Ma + Ia | 0) > 0) {
                                                Oa = Ia + -3 + Na | 0;
                                                Na = 0;
                                                Pa = 0;
                                                do {
                                                    Pa = gb((c[s >> 2] | 0) + 224 | 0) | 0 | Pa << 1;
                                                    Na = Na + 1 | 0
                                                } while ((Na | 0) != (Oa | 0))
                                            } else Pa = 0;
                                            Na = Pa + ((1 << Ma) + 2 << Ia) | 0
                                        }
                                        La = gf(Na | 0, ((Na | 0) < 0) << 31 >> 31 | 0, La | 0, 0) | 0;
                                        Ma = D;
                                        Oa = 3 << Ia;
                                        Qa = ((Oa | 0) < 0) << 31 >> 31;
                                        Pa = c[(c[r >> 2] | 0) + 13116 >> 2] | 0;
                                        do
                                            if ((Ma | 0) > (Qa | 0) | (Ma | 0) == (Qa | 0) & La >>> 0 > Oa >>> 0) {
                                                Oa = Ia + 1 | 0;
                                                if (Pa) {
                                                    Ia = Oa;
                                                    break
                                                }
                                                Ia = (Ia | 0) > 3 ? 4 : Oa;
                                                break c
                                            }
                                        while (0);
                                        if (!((Pa | 0) != 0 & (Ja | 0) == 0)) break;
                                        Oa = a[ya >> 0] | 0;
                                        Ja = (Oa & 255) >>> 2;
                                        if ((Na | 0) >= (3 << Ja | 0)) {
                                            a[ya >> 0] = Oa + 1 << 24 >> 24;
                                            Ja = 1;
                                            break
                                        }
                                        if ((Na << 1 | 0) >= (1 << Ja | 0) | Oa << 24 >> 24 == 0) {
                                            Ja = 1;
                                            break
                                        }
                                        a[ya >> 0] = Oa + -1 << 24 >> 24;
                                        Ja = 1
                                    } else {
                                        La = 0;
                                        while (1) {
                                            Ma = La + 1 | 0;
                                            if (!(gb((c[s >> 2] | 0) + 224 | 0) | 0)) {
                                                u = 146;
                                                break
                                            }
                                            if ((Ma | 0) < 31) La = Ma;
                                            else {
                                                u = 150;
                                                break
                                            }
                                        }
                                        do
                                            if ((u | 0) == 146) {
                                                u = 0;
                                                if ((La | 0) >= 3) {
                                                    Ma = La;
                                                    u = 150;
                                                    break
                                                }
                                                if ((Ia | 0) > 0) {
                                                    Ma = 0;
                                                    Na = 0;
                                                    do {
                                                        Na = gb((c[s >> 2] | 0) + 224 | 0) | 0 | Na << 1;
                                                        Ma = Ma + 1 | 0
                                                    } while ((Ma | 0) != (Ia | 0))
                                                } else Na = 0;
                                                Na = Na + (La << Ia) | 0
                                            }
                                        while (0);
                                        if ((u | 0) == 150) {
                                            u = 0;
                                            La = Ma + -3 | 0;
                                            if ((La + Ia | 0) > 0) {
                                                Ma = Ia + -3 + Ma | 0;
                                                Na = 0;
                                                Oa = 0;
                                                do {
                                                    Oa = gb((c[s >> 2] | 0) + 224 | 0) | 0 | Oa << 1;
                                                    Na = Na + 1 | 0
                                                } while ((Na | 0) != (Ma | 0))
                                            } else Oa = 0;
                                            Na = Oa + ((1 << La) + 2 << Ia) | 0
                                        }
                                        La = Na + 1 | 0;
                                        Ma = ((La | 0) < 0) << 31 >> 31;
                                        Pa = c[(c[r >> 2] | 0) + 13116 >> 2] | 0;
                                        do
                                            if ((Na | 0) >= (3 << Ia | 0)) {
                                                Oa = Ia + 1 | 0;
                                                if (Pa) {
                                                    Ia = Oa;
                                                    break
                                                }
                                                Ia = (Ia | 0) > 3 ? 4 : Oa;
                                                break c
                                            }
                                        while (0);
                                        if (!((Pa | 0) != 0 & (Ja | 0) == 0)) break;
                                        Oa = a[ya >> 0] | 0;
                                        Ja = (Oa & 255) >>> 2;
                                        if ((Na | 0) >= (3 << Ja | 0)) {
                                            a[ya >> 0] = Oa + 1 << 24 >> 24;
                                            Ja = 1;
                                            break
                                        }
                                        if ((Na << 1 | 0) >= (1 << Ja | 0) | Oa << 24 >> 24 == 0) {
                                            Ja = 1;
                                            break
                                        }
                                        a[ya >> 0] = Oa + -1 << 24 >> 24;
                                        Ja = 1
                                    }
                                while (0);
                                do
                                    if (!((a[(c[ka >> 2] | 0) + 4 >> 0] | 0) == 0 | va)) {
                                        Ha = gf(La | 0, Ma | 0, Ha | 0, 0) | 0;
                                        if (Ga << 24 >> 24 != ua << 24 >> 24) break;
                                        Qa = (Ha & 1 | 0) == 0;
                                        Pa = ff(0, 0, La | 0, Ma | 0) | 0;
                                        La = Qa ? La : Pa;
                                        Ma = Qa ? Ma : D
                                    }
                                while (0);
                                Qa = (Ca & 32768 | 0) == 0;
                                Ga = ff(0, 0, La | 0, Ma | 0) | 0;
                                Ga = Qa ? La : Ga;
                                La = Qa ? Ma : D;
                                Ca = Ca << 1 & 131070;
                                Ma = Ga & 65535;
                                do
                                    if (!(a[z >> 0] | 0)) {
                                        do
                                            if (!((a[(c[r >> 2] | 0) + 634 >> 0] | 0) == 0 | _)) {
                                                if (!((Aa | Ba | 0) != 0 | fa)) {
                                                    Da = pa;
                                                    break
                                                }
                                                if ((j | 0) == 3) Da = (Aa << 3) + Ba | 0;
                                                else if ((j | 0) == 4) Da = (Aa >>> 1 << 3) + (Ba >>> 1) | 0;
                                                else if ((j | 0) == 5) Da = (Aa >>> 2 << 3) + (Ba >>> 2) | 0;
                                                else Da = (Aa << 2) + Ba | 0;
                                                Da = d[E + Da >> 0] | 0
                                            }
                                        while (0);
                                        Ga = rf(Ga | 0, La | 0, B | 0, ca | 0) | 0;
                                        Ga = rf(Ga | 0, D | 0, Da | 0, ((Da | 0) < 0) << 31 >> 31 | 0) | 0;
                                        Ga = gf(Ga | 0, D | 0, A | 0, ba | 0) | 0;
                                        Ga = ef(Ga | 0, D | 0, H | 0) | 0;
                                        La = D;
                                        if ((La | 0) < 0) {
                                            Ma = (Ga & -32768 | 0) == -32768 & (La & 268435455 | 0) == 268435455 ? Ga & 65535 : -32768;
                                            break
                                        } else {
                                            Ma = La >>> 0 > 0 | (La | 0) == 0 & Ga >>> 0 > 32767 ? 32767 : Ga & 65535;
                                            break
                                        }
                                    }
                                while (0);
                                b[h + ((Aa << j) + Ba << 1) >> 1] = Ma;
                                za = za + 1 | 0;
                                if ((za | 0) >= (qa | 0)) {
                                    Aa = Da;
                                    break a
                                }
                                Ga = a[t + za >> 0] | 0
                            }
                        }
                    while (0);
                    if (na) oa = oa + -1 | 0;
                    else break
                }
            }
            do
                if (!(a[z >> 0] | 0)) {
                    if (I) {
                        if (((j | 0) == 2 ? (c[(c[r >> 2] | 0) + 13096 >> 2] | 0) != 0 : 0) ? (c[F >> 2] | 0) == 1 : 0) {
                            s = 0;
                            do {
                                Oa = h + (15 - s << 1) | 0;
                                Pa = b[Oa >> 1] | 0;
                                Qa = h + (s << 1) | 0;
                                b[Oa >> 1] = b[Qa >> 1] | 0;
                                b[Qa >> 1] = Pa;
                                s = s + 1 | 0
                            } while ((s | 0) != 8)
                        }
                        s = j & 65535;
                        Fa[c[f + 5872 >> 2] & 15](h, s);
                        if (!G) {
                            if (!(c[(c[r >> 2] | 0) + 13104 >> 2] | 0)) break;
                            if ((c[F >> 2] | 0) != 1) break;
                            if ((x & -17 | 0) != 10) break;
                            C = (x | 0) == 26 & 1
                        }
                        Ka[c[f + 5876 >> 2] & 7](h, s, C);
                        break
                    }
                    if (y & (c[F >> 2] | 0) == 1 & (j | 0) == 2) {
                        Ea[c[f + 5880 >> 2] & 7](h);
                        break
                    }
                    r = (J | 0) > (K | 0) ? J : K;
                    if (!r) {
                        Ea[c[f + (j + -2 << 2) + 5900 >> 2] & 7](h);
                        break
                    }
                    s = K + 4 + J | 0;
                    do
                        if ((r | 0) >= 4) {
                            if ((r | 0) < 8) {
                                s = (s | 0) < 8 ? s : 8;
                                break
                            }
                            if ((r | 0) < 12) s = (s | 0) < 24 ? s : 24
                        } else s = (s | 0) < 4 ? s : 4;
                    while (0);
                    Fa[c[f + (j + -2 << 2) + 5884 >> 2] & 15](h, s)
                } else {
                    r = (c[(c[r >> 2] | 0) + 13104 >> 2] | 0) == 0;
                    if (!G) {
                        if (r) break;
                        if ((x & -17 | 0) == 10) u = 185;
                        else break
                    } else if (!r) u = 185;
                    if ((u | 0) == 185) C = (x | 0) == 26 & 1;
                    Ka[c[f + 5876 >> 2] & 7](h, j & 65535, C)
                }
            while (0);
            if (!(a[p + 304 >> 0] | 0)) {
                Qa = j + -2 | 0;
                Qa = f + (Qa << 2) + 5856 | 0;
                Qa = c[Qa >> 2] | 0;
                Ka[Qa & 7](o, h, n);
                i = m;
                return
            }
            if ((q | 0) <= 0) {
                Qa = j + -2 | 0;
                Qa = f + (Qa << 2) + 5856 | 0;
                Qa = c[Qa >> 2] | 0;
                Ka[Qa & 7](o, h, n);
                i = m;
                return
            }
            p = c[p + 284 >> 2] | 0;
            r = 0;
            do {
                Qa = h + (r << 1) | 0;
                b[Qa >> 1] = (($(b[g + (r << 1) >> 1] | 0, p) | 0) >>> 3) + (e[Qa >> 1] | 0);
                r = r + 1 | 0
            } while ((r | 0) != (q | 0));
            Qa = j + -2 | 0;
            Qa = f + (Qa << 2) + 5856 | 0;
            Qa = c[Qa >> 2] | 0;
            Ka[Qa & 7](o, h, n);
            i = m;
            return
        }

        function Mb(a, d, e, f) {
            a = a | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            var g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0;
            f = i;
            e = a + 136 | 0;
            a = c[e >> 2] | 0;
            d = eb(a + 224 | 0, a + 31 | 0) | 0;
            g = c[e >> 2] | 0;
            g = eb(g + 224 | 0, g + 31 | 0) | 0;
            if (!d) d = 0;
            else {
                l = c[e >> 2] | 0;
                d = (eb(l + 224 | 0, l + 34 | 0) | 0) + d | 0
            }
            if (!g) g = 0;
            else {
                l = c[e >> 2] | 0;
                g = (eb(l + 224 | 0, l + 34 | 0) | 0) + g | 0
            }
            if ((d | 0) == 2) {
                k = 1;
                j = 2;
                while (1) {
                    if (!(gb((c[e >> 2] | 0) + 224 | 0) | 0)) {
                        d = 7;
                        break
                    }
                    j = (1 << k) + j | 0;
                    k = k + 1 | 0;
                    if ((k | 0) >= 31) {
                        d = 9;
                        break
                    }
                }
                if ((d | 0) == 7) {
                    h = c[e >> 2] | 0;
                    l = h + 224 | 0;
                    if (!k) k = l;
                    else {
                        h = l;
                        d = 10
                    }
                } else if ((d | 0) == 9) {
                    h = (c[e >> 2] | 0) + 224 | 0;
                    d = 10
                }
                if ((d | 0) == 10)
                    while (1) {
                        k = k + -1 | 0;
                        j = ((gb(h) | 0) << k) + j | 0;
                        h = c[e >> 2] | 0;
                        d = h + 224 | 0;
                        if (!k) {
                            k = d;
                            break
                        } else {
                            h = d;
                            d = 10
                        }
                    }
                d = c[k >> 2] << 1;
                c[k >> 2] = d;
                if (!(d & 65534)) {
                    Nb(k);
                    d = c[k >> 2] | 0
                }
                m = c[h + 228 >> 2] << 17;
                h = d - m | 0;
                l = h >> 31;
                c[k >> 2] = (l & m) + h;
                b[a + 31272 >> 1] = (l ^ 0 - j) - l
            } else if ((d | 0) == 1) {
                h = c[e >> 2] | 0;
                d = h + 224 | 0;
                j = c[d >> 2] << 1;
                c[d >> 2] = j;
                if (!(j & 65534)) {
                    Nb(d);
                    j = c[d >> 2] | 0
                }
                k = c[h + 228 >> 2] << 17;
                l = j - k | 0;
                m = l >> 31;
                c[d >> 2] = (m & k) + l;
                b[a + 31272 >> 1] = (m ^ 65535) - m
            } else if (!d) b[a + 31272 >> 1] = 0;
            if ((g | 0) == 1) {
                d = c[e >> 2] | 0;
                e = d + 224 | 0;
                g = c[e >> 2] << 1;
                c[e >> 2] = g;
                if (!(g & 65534)) {
                    Nb(e);
                    g = c[e >> 2] | 0
                }
                k = c[d + 228 >> 2] << 17;
                l = g - k | 0;
                m = l >> 31;
                c[e >> 2] = (m & k) + l;
                b[a + 31274 >> 1] = (m ^ 65535) - m;
                i = f;
                return
            } else if (!g) {
                b[a + 31274 >> 1] = 0;
                i = f;
                return
            } else if ((g | 0) == 2) {
                h = 1;
                j = 2;
                while (1) {
                    if (!(gb((c[e >> 2] | 0) + 224 | 0) | 0)) {
                        d = 20;
                        break
                    }
                    j = (1 << h) + j | 0;
                    h = h + 1 | 0;
                    if ((h | 0) >= 31) {
                        d = 22;
                        break
                    }
                }
                if ((d | 0) == 20) {
                    k = c[e >> 2] | 0;
                    g = k + 224 | 0;
                    if (!h) e = k;
                    else d = 23
                } else if ((d | 0) == 22) {
                    g = (c[e >> 2] | 0) + 224 | 0;
                    d = 23
                }
                if ((d | 0) == 23)
                    while (1) {
                        h = h + -1 | 0;
                        j = ((gb(g) | 0) << h) + j | 0;
                        d = c[e >> 2] | 0;
                        g = d + 224 | 0;
                        if (!h) {
                            e = d;
                            break
                        } else d = 23
                    }
                d = c[g >> 2] << 1;
                c[g >> 2] = d;
                if (!(d & 65534)) {
                    Nb(g);
                    d = c[g >> 2] | 0
                }
                k = c[e + 228 >> 2] << 17;
                l = d - k | 0;
                m = l >> 31;
                c[g >> 2] = (m & k) + l;
                b[a + 31274 >> 1] = (m ^ 0 - j) - m;
                i = f;
                return
            } else {
                i = f;
                return
            }
        }

        function Nb(a) {
            a = a | 0;
            var b = 0,
                e = 0,
                f = 0;
            b = i;
            f = a + 16 | 0;
            e = c[f >> 2] | 0;
            c[a >> 2] = (c[a >> 2] | 0) + -65535 + ((d[e + 1 >> 0] | 0) << 1 | (d[e >> 0] | 0) << 9);
            if (e >>> 0 >= (c[a + 20 >> 2] | 0) >>> 0) {
                i = b;
                return
            }
            c[f >> 2] = e + 2;
            i = b;
            return
        }

        function Ob(b, d, e, f) {
            b = b | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            var g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0;
            f = i;
            h = b + 136 | 0;
            n = c[h >> 2] | 0;
            g = b + 200 | 0;
            j = c[g >> 2] | 0;
            m = c[j + 13080 >> 2] | 0;
            q = (1 << m) + -1 | 0;
            m = -1 << m - (c[(c[b + 204 >> 2] | 0) + 24 >> 2] | 0);
            o = m & d;
            p = m & e;
            k = c[j + 13140 >> 2] | 0;
            j = c[j + 13064 >> 2] | 0;
            l = o >> j;
            j = p >> j;
            if (!(q & d)) o = 0;
            else o = (o & q | 0) != 0;
            if (!(q & e)) p = 0;
            else p = (p & q | 0) != 0;
            q = n + 203 | 0;
            if ((a[q >> 0] | 0) == 0 ? (m & (e | d) | 0) != 0 : 0) d = c[n + 276 >> 2] | 0;
            else {
                a[q >> 0] = (a[n + 300 >> 0] | 0) == 0 & 1;
                d = a[b + 3100 >> 0] | 0
            }
            if (o) {
                e = l + -1 + ($(j, k) | 0) | 0;
                e = a[(c[b + 7568 >> 2] | 0) + e >> 0] | 0
            } else e = d;
            if (p) {
                d = ($(j + -1 | 0, k) | 0) + l | 0;
                d = a[(c[b + 7568 >> 2] | 0) + d >> 0] | 0
            }
            b = e + 1 + d >> 1;
            h = c[h >> 2] | 0;
            j = c[h + 280 >> 2] | 0;
            if (!j) {
                a[h + 272 >> 0] = b;
                i = f;
                return
            }
            g = c[(c[g >> 2] | 0) + 13192 >> 2] | 0;
            b = j + 52 + b + (g << 1) | 0;
            if ((b | 0) > 0) j = b;
            else j = -52 - g + 1 + b | 0;
            a[h + 272 >> 0] = b - g - j + ((j | 0) % (g + 52 | 0) | 0);
            i = f;
            return
        }

        function Pb(b, d, e, f) {
            b = b | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            var g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                D = 0,
                E = 0,
                F = 0,
                G = 0,
                H = 0,
                I = 0,
                J = 0,
                K = 0;
            k = i;
            t = c[b + 136 >> 2] | 0;
            r = b + 200 | 0;
            v = c[r >> 2] | 0;
            g = c[v + 13084 >> 2] | 0;
            p = c[v + 13072 >> 2] | 0;
            h = c[v + 13156 >> 2] | 0;
            l = c[v + 13148 >> 2] | 0;
            o = b + 3508 | 0;
            u = c[o >> 2] | 0;
            j = c[u + 16 >> 2] | 0;
            q = $(h, e >> g) | 0;
            m = d >> g;
            n = (a[j + ((q + m | 0) * 12 | 0) + 10 >> 0] | 0) == 0;
            do
                if ((e | 0) > 0 & (e & 7 | 0) == 0) {
                    if (((a[b + 3050 >> 0] | 0) == 0 ? (c[t + 31312 >> 2] & 4 | 0) != 0 : 0) ? ((e | 0) % (1 << c[v + 13080 >> 2] | 0) | 0 | 0) == 0 : 0) break;
                    if ((a[(c[b + 204 >> 2] | 0) + 53 >> 0] | 0) == 0 ? (w = c[t + 31312 >> 2] | 0, (w & 8 | 0) != 0) : 0) {
                        if (!((e | 0) % (1 << c[v + 13080 >> 2] | 0) | 0)) break
                    } else w = c[t + 31312 >> 2] | 0;
                    if (!(w & 4)) {
                        u = c[u + 20 >> 2] | 0;
                        x = e + -1 | 0
                    } else {
                        x = e + -1 | 0;
                        u = qc(b, u, d, x) | 0
                    }
                    w = 1 << f;
                    if ((w | 0) > 0) {
                        v = $(h, x >> g) | 0;
                        B = $(l, x >> p) | 0;
                        A = b + 7596 | 0;
                        C = $(l, e >> p) | 0;
                        x = b + 5840 | 0;
                        y = b + 7572 | 0;
                        D = 0;
                        do {
                            z = D + d | 0;
                            J = z >> g;
                            G = z >> p;
                            I = J + v | 0;
                            E = j + (I * 12 | 0) | 0;
                            J = J + q | 0;
                            F = j + (J * 12 | 0) | 0;
                            K = c[A >> 2] | 0;
                            H = a[K + (G + B) >> 0] | 0;
                            G = a[K + (G + C) >> 0] | 0;
                            if ((a[j + (J * 12 | 0) + 10 >> 0] | 0) != 0 ? (a[j + (I * 12 | 0) + 10 >> 0] | 0) != 0 : 0)
                                if (!((G | H) << 24 >> 24)) E = (Qb(b, F, E, u) | 0) & 255;
                                else E = 1;
                            else E = 2;
                            K = ($(c[x >> 2] | 0, e) | 0) + z >> 2;
                            a[(c[y >> 2] | 0) + K >> 0] = E;
                            D = D + 4 | 0
                        } while ((D | 0) < (w | 0))
                    }
                }
            while (0);
            do
                if ((d | 0) > 0 & (d & 7 | 0) == 0) {
                    if (((a[b + 3050 >> 0] | 0) == 0 ? (c[t + 31312 >> 2] & 1 | 0) != 0 : 0) ? ((d | 0) % (1 << c[(c[r >> 2] | 0) + 13080 >> 2] | 0) | 0 | 0) == 0 : 0) break;
                    if ((a[(c[b + 204 >> 2] | 0) + 53 >> 0] | 0) == 0 ? (s = c[t + 31312 >> 2] | 0, (s & 2 | 0) != 0) : 0) {
                        if (!((d | 0) % (1 << c[(c[r >> 2] | 0) + 13080 >> 2] | 0) | 0)) break
                    } else s = c[t + 31312 >> 2] | 0;
                    q = c[o >> 2] | 0;
                    if (!(s & 1)) {
                        r = c[q + 20 >> 2] | 0;
                        s = d + -1 | 0
                    } else {
                        s = d + -1 | 0;
                        r = qc(b, q, s, e) | 0
                    }
                    q = s >> g;
                    w = s >> p;
                    x = d >> p;
                    z = 1 << f;
                    if ((z | 0) > 0) {
                        v = b + 7596 | 0;
                        y = b + 5840 | 0;
                        u = b + 7576 | 0;
                        t = 0;
                        do {
                            s = t + e | 0;
                            J = $(s >> g, h) | 0;
                            K = J + q | 0;
                            A = j + (K * 12 | 0) | 0;
                            J = J + m | 0;
                            B = j + (J * 12 | 0) | 0;
                            C = $(s >> p, l) | 0;
                            I = c[v >> 2] | 0;
                            D = a[I + (C + w) >> 0] | 0;
                            C = a[I + (C + x) >> 0] | 0;
                            if ((a[j + (J * 12 | 0) + 10 >> 0] | 0) != 0 ? (a[j + (K * 12 | 0) + 10 >> 0] | 0) != 0 : 0)
                                if (!((C | D) << 24 >> 24)) A = (Qb(b, B, A, r) | 0) & 255;
                                else A = 1;
                            else A = 2;
                            K = ($(c[y >> 2] | 0, s) | 0) + d >> 2;
                            a[(c[u >> 2] | 0) + K >> 0] = A;
                            t = t + 4 | 0
                        } while ((t | 0) < (z | 0))
                    }
                }
            while (0);
            if ((g | 0) >= (f | 0) | n) {
                i = k;
                return
            }
            l = c[(c[o >> 2] | 0) + 20 >> 2] | 0;
            m = 1 << f;
            f = (m | 0) > 8;
            if (f) {
                q = b + 5840 | 0;
                r = b + 7572 | 0;
                s = 8;
                do {
                    n = s + e | 0;
                    t = $(n + -1 >> g, h) | 0;
                    o = $(n >> g, h) | 0;
                    p = 0;
                    do {
                        K = p + d | 0;
                        J = K >> g;
                        J = (Qb(b, j + ((J + o | 0) * 12 | 0) | 0, j + ((J + t | 0) * 12 | 0) | 0, l) | 0) & 255;
                        K = ($(c[q >> 2] | 0, n) | 0) + K >> 2;
                        a[(c[r >> 2] | 0) + K >> 0] = J;
                        p = p + 4 | 0
                    } while ((p | 0) < (m | 0));
                    s = s + 8 | 0
                } while ((s | 0) < (m | 0))
            }
            if ((m | 0) <= 0) {
                i = k;
                return
            }
            n = b + 5840 | 0;
            o = b + 7576 | 0;
            p = 0;
            do {
                q = p + e | 0;
                if (f) {
                    r = $(q >> g, h) | 0;
                    s = 8;
                    do {
                        K = s + d | 0;
                        J = (Qb(b, j + (((K >> g) + r | 0) * 12 | 0) | 0, j + (((K + -1 >> g) + r | 0) * 12 | 0) | 0, l) | 0) & 255;
                        K = ($(c[n >> 2] | 0, q) | 0) + K >> 2;
                        a[(c[o >> 2] | 0) + K >> 0] = J;
                        s = s + 8 | 0
                    } while ((s | 0) < (m | 0))
                }
                p = p + 4 | 0
            } while ((p | 0) < (m | 0));
            i = k;
            return
        }

        function Qb(d, e, f, g) {
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            var h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0;
            h = i;
            m = a[e + 10 >> 0] | 0;
            k = a[f + 10 >> 0] | 0;
            l = k << 24 >> 24 == 3;
            if (m << 24 >> 24 != 3) {
                if (l) {
                    m = 1;
                    i = h;
                    return m | 0
                }
                if (!(m & 1)) {
                    l = e + 4 | 0;
                    j = e + 6 | 0;
                    e = (c[(c[d + 3508 >> 2] | 0) + 20 >> 2] | 0) + (a[e + 9 >> 0] << 2) + 260 | 0
                } else {
                    l = e;
                    j = e + 2 | 0;
                    e = (c[(c[d + 3508 >> 2] | 0) + 20 >> 2] | 0) + (a[e + 8 >> 0] << 2) + 64 | 0
                }
                if (!(k & 1)) {
                    k = f + 4 | 0;
                    d = f + 6 | 0;
                    f = g + (a[f + 9 >> 0] << 2) + 260 | 0
                } else {
                    k = f;
                    d = f + 2 | 0;
                    f = g + (a[f + 8 >> 0] << 2) + 64 | 0
                }
                if ((c[e >> 2] | 0) != (c[f >> 2] | 0)) {
                    m = 1;
                    i = h;
                    return m | 0
                }
                m = (b[l >> 1] | 0) - (b[k >> 1] | 0) | 0;
                if ((((m | 0) > -1 ? m : 0 - m | 0) | 0) > 3) {
                    m = 1;
                    i = h;
                    return m | 0
                }
                m = (b[j >> 1] | 0) - (b[d >> 1] | 0) | 0;
                m = (((m | 0) > -1 ? m : 0 - m | 0) | 0) > 3 & 1;
                i = h;
                return m | 0
            }
            if (!l) {
                m = 1;
                i = h;
                return m | 0
            }
            l = c[(c[d + 3508 >> 2] | 0) + 20 >> 2] | 0;
            k = c[l + (a[e + 8 >> 0] << 2) + 64 >> 2] | 0;
            d = c[g + (a[f + 8 >> 0] << 2) + 64 >> 2] | 0;
            m = (k | 0) == (d | 0);
            a: do
                if (m) {
                    do
                        if ((k | 0) == (c[l + (a[e + 9 >> 0] << 2) + 260 >> 2] | 0)) {
                            if ((k | 0) != (c[g + (a[f + 9 >> 0] << 2) + 260 >> 2] | 0))
                                if (m) break;
                                else {
                                    j = 16;
                                    break a
                                }
                            g = b[f >> 1] | 0;
                            j = b[e >> 1] | 0;
                            m = g - j | 0;
                            if (!((((((m | 0) > -1 ? m : 0 - m | 0) | 0) <= 3 ? (m = (b[f + 2 >> 1] | 0) - (b[e + 2 >> 1] | 0) | 0, (((m | 0) > -1 ? m : 0 - m | 0) | 0) <= 3) : 0) ? (m = (b[f + 4 >> 1] | 0) - (b[e + 4 >> 1] | 0) | 0, (((m | 0) > -1 ? m : 0 - m | 0) | 0) <= 3) : 0) ? (m = (b[f + 6 >> 1] | 0) - (b[e + 6 >> 1] | 0) | 0, (((m | 0) > -1 ? m : 0 - m | 0) | 0) <= 3) : 0)) {
                                m = (b[f + 4 >> 1] | 0) - j | 0;
                                if ((((m | 0) > -1 ? m : 0 - m | 0) | 0) > 3) {
                                    m = 1;
                                    i = h;
                                    return m | 0
                                }
                                m = (b[f + 6 >> 1] | 0) - (b[e + 2 >> 1] | 0) | 0;
                                if ((((m | 0) > -1 ? m : 0 - m | 0) | 0) > 3) {
                                    m = 1;
                                    i = h;
                                    return m | 0
                                }
                                m = g - (b[e + 4 >> 1] | 0) | 0;
                                if ((((m | 0) > -1 ? m : 0 - m | 0) | 0) > 3) {
                                    m = 1;
                                    i = h;
                                    return m | 0
                                }
                                m = (b[f + 2 >> 1] | 0) - (b[e + 6 >> 1] | 0) | 0;
                                if ((((m | 0) > -1 ? m : 0 - m | 0) | 0) > 3) {
                                    m = 1;
                                    i = h;
                                    return m | 0
                                }
                            }
                            m = 0;
                            i = h;
                            return m | 0
                        }
                    while (0);
                    g = c[g + (a[f + 9 >> 0] << 2) + 260 >> 2] | 0;
                    if ((g | 0) == (c[l + (a[e + 9 >> 0] << 2) + 260 >> 2] | 0)) {
                        m = (b[f >> 1] | 0) - (b[e >> 1] | 0) | 0;
                        if ((((m | 0) > -1 ? m : 0 - m | 0) | 0) > 3) {
                            m = 1;
                            i = h;
                            return m | 0
                        }
                        m = (b[f + 2 >> 1] | 0) - (b[e + 2 >> 1] | 0) | 0;
                        if ((((m | 0) > -1 ? m : 0 - m | 0) | 0) > 3) {
                            m = 1;
                            i = h;
                            return m | 0
                        }
                        m = (b[f + 4 >> 1] | 0) - (b[e + 4 >> 1] | 0) | 0;
                        if ((((m | 0) > -1 ? m : 0 - m | 0) | 0) > 3) {
                            m = 1;
                            i = h;
                            return m | 0
                        } else {
                            m = (b[f + 6 >> 1] | 0) - (b[e + 6 >> 1] | 0) | 0;
                            i = h;
                            return (((m | 0) > -1 ? m : 0 - m | 0) | 0) > 3 | 0
                        }
                    }
                } else j = 16;
            while (0);
            if ((j | 0) == 16) g = c[g + (a[f + 9 >> 0] << 2) + 260 >> 2] | 0;
            if ((g | 0) != (k | 0)) {
                m = 1;
                i = h;
                return m | 0
            }
            if ((d | 0) != (c[l + (a[e + 9 >> 0] << 2) + 260 >> 2] | 0)) {
                m = 1;
                i = h;
                return m | 0
            }
            m = (b[f + 4 >> 1] | 0) - (b[e >> 1] | 0) | 0;
            if ((((m | 0) > -1 ? m : 0 - m | 0) | 0) > 3) {
                m = 1;
                i = h;
                return m | 0
            }
            m = (b[f + 6 >> 1] | 0) - (b[e + 2 >> 1] | 0) | 0;
            if ((((m | 0) > -1 ? m : 0 - m | 0) | 0) > 3) {
                m = 1;
                i = h;
                return m | 0
            }
            m = (b[f >> 1] | 0) - (b[e + 4 >> 1] | 0) | 0;
            if ((((m | 0) > -1 ? m : 0 - m | 0) | 0) > 3) {
                m = 1;
                i = h;
                return m | 0
            }
            m = (b[f + 2 >> 1] | 0) - (b[e + 6 >> 1] | 0) | 0;
            m = (((m | 0) > -1 ? m : 0 - m | 0) | 0) > 3 & 1;
            i = h;
            return m | 0
        }

        function Rb(e, f, g, h) {
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            var j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                D = 0,
                E = 0,
                F = 0,
                G = 0,
                H = 0,
                I = 0,
                J = 0,
                K = 0,
                L = 0,
                M = 0,
                N = 0,
                O = 0,
                P = 0,
                Q = 0,
                R = 0,
                S = 0,
                T = 0,
                U = 0,
                V = 0,
                W = 0,
                X = 0,
                Y = 0,
                Z = 0,
                _ = 0,
                aa = 0,
                ba = 0,
                ca = 0,
                da = 0;
            j = i;
            i = i + 32 | 0;
            o = j + 8 | 0;
            w = j;
            n = j + 18 | 0;
            r = j + 16 | 0;
            l = e + 200 | 0;
            J = c[l >> 2] | 0;
            u = c[J + 13120 >> 2] | 0;
            k = (u - h | 0) <= (f | 0);
            b[n >> 1] = 0;
            b[r >> 1] = 0;
            v = c[J + 13080 >> 2] | 0;
            t = 1 << v;
            v = ($(g >> v, c[J + 13128 >> 2] | 0) | 0) + (f >> v) | 0;
            s = c[e + 3496 >> 2] | 0;
            m = c[s + (v << 3) + 4 >> 2] | 0;
            x = c[s + (v << 3) >> 2] | 0;
            if ((c[J + 68 >> 2] | 0) != 0 ? (a[J + 13056 >> 0] | 0) != 0 : 0) p = 1;
            else p = (a[(c[e + 204 >> 2] | 0) + 40 >> 0] | 0) != 0;
            q = (f | 0) != 0;
            if (q) {
                v = v + -1 | 0;
                y = c[s + (v << 3) >> 2] | 0;
                v = c[s + (v << 3) + 4 >> 2] | 0
            } else {
                y = 0;
                v = 0
            }
            s = t + f | 0;
            s = (s | 0) > (u | 0) ? u : s;
            t = t + g | 0;
            z = c[J + 13124 >> 2] | 0;
            t = (t | 0) > (z | 0) ? z : t;
            z = (s | 0) == (u | 0) ? s : s + -8 | 0;
            u = (t | 0) > (g | 0);
            if (u) {
                J = q ? f : 8;
                M = (J | 0) < (s | 0);
                P = q ? f + -8 | 0 : 0;
                E = e + 5840 | 0;
                O = e + 7572 | 0;
                H = e + 7568 | 0;
                B = w + 4 | 0;
                C = e + 160 | 0;
                D = n + 1 | 0;
                Q = r + 1 | 0;
                K = e + 7544 | 0;
                L = e + 7528 | 0;
                I = e + 7576 | 0;
                F = e + 7548 | 0;
                G = e + 7532 | 0;
                A = (P | 0) >= (z | 0);
                T = x;
                S = m;
                N = g;
                do {
                    if (M) {
                        R = N + 4 | 0;
                        W = S + -2 & -2;
                        U = J;
                        do {
                            Z = c[E >> 2] | 0;
                            ba = ($(Z, N) | 0) + U >> 2;
                            _ = c[I >> 2] | 0;
                            ba = a[_ + ba >> 0] | 0;
                            ca = ba & 255;
                            Z = a[_ + (($(Z, R) | 0) + U >> 2) >> 0] | 0;
                            _ = Z & 255;
                            ba = ba << 24 >> 24 != 0;
                            Z = Z << 24 >> 24 == 0;
                            do
                                if (!(Z & (ba ^ 1))) {
                                    V = U + -1 | 0;
                                    X = c[l >> 2] | 0;
                                    aa = c[X + 13064 >> 2] | 0;
                                    Y = $(N >> aa, c[X + 13140 >> 2] | 0) | 0;
                                    da = c[H >> 2] | 0;
                                    aa = (a[da + (Y + (V >> aa)) >> 0] | 0) + 1 + (a[da + (Y + (U >> aa)) >> 0] | 0) >> 1;
                                    Y = aa + T | 0;
                                    if ((Y | 0) < 0) Y = 0;
                                    else Y = (Y | 0) > 51 ? 51 : Y;
                                    Y = d[1280 + Y >> 0] | 0;
                                    if (ba) {
                                        ba = (ca << 1) + W + aa | 0;
                                        if ((ba | 0) < 0) ba = 0;
                                        else ba = (ba | 0) > 53 ? 53 : ba;
                                        ba = d[1336 + ba >> 0] | 0
                                    } else ba = 0;
                                    c[w >> 2] = ba;
                                    if (Z) Z = 0;
                                    else {
                                        Z = (_ << 1) + W + aa | 0;
                                        if ((Z | 0) < 0) Z = 0;
                                        else Z = (Z | 0) > 53 ? 53 : Z;
                                        Z = d[1336 + Z >> 0] | 0
                                    }
                                    c[B >> 2] = Z;
                                    ca = c[C >> 2] | 0;
                                    Z = c[ca + 32 >> 2] | 0;
                                    da = $(Z, N) | 0;
                                    X = (c[ca >> 2] | 0) + ((U << c[X + 56 >> 2]) + da) | 0;
                                    if (p) {
                                        a[n >> 0] = Wb(e, V, N) | 0;
                                        a[D >> 0] = Wb(e, V, R) | 0;
                                        a[r >> 0] = Wb(e, U, N) | 0;
                                        a[Q >> 0] = Wb(e, U, R) | 0;
                                        Na[c[F >> 2] & 3](X, Z, Y, w, n, r);
                                        break
                                    } else {
                                        Na[c[G >> 2] & 3](X, Z, Y, w, n, r);
                                        break
                                    }
                                }
                            while (0);
                            U = U + 8 | 0
                        } while ((U | 0) < (s | 0))
                    }
                    if (!((N | 0) == 0 | A)) {
                        R = N + -1 | 0;
                        V = S;
                        S = P;
                        do {
                            Y = $(c[E >> 2] | 0, N) | 0;
                            Z = c[O >> 2] | 0;
                            aa = a[Z + (Y + S >> 2) >> 0] | 0;
                            ba = aa & 255;
                            U = S + 4 | 0;
                            Y = a[Z + (Y + U >> 2) >> 0] | 0;
                            Z = Y & 255;
                            aa = aa << 24 >> 24 != 0;
                            Y = Y << 24 >> 24 == 0;
                            do
                                if (!(Y & (aa ^ 1))) {
                                    W = c[l >> 2] | 0;
                                    V = c[W + 13064 >> 2] | 0;
                                    _ = S >> V;
                                    T = c[W + 13140 >> 2] | 0;
                                    da = ($(R >> V, T) | 0) + _ | 0;
                                    X = c[H >> 2] | 0;
                                    _ = (a[X + da >> 0] | 0) + 1 + (a[X + (($(N >> V, T) | 0) + _) >> 0] | 0) >> 1;
                                    T = (S | 0) >= (f | 0);
                                    V = T ? m : v;
                                    T = T ? x : y;
                                    X = _ + T | 0;
                                    if ((X | 0) < 0) X = 0;
                                    else X = (X | 0) > 51 ? 51 : X;
                                    X = d[1280 + X >> 0] | 0;
                                    if (aa) {
                                        aa = (ba << 1) + (V + -2 & -2) + _ | 0;
                                        if ((aa | 0) < 0) aa = 0;
                                        else aa = (aa | 0) > 53 ? 53 : aa;
                                        aa = d[1336 + aa >> 0] | 0
                                    } else aa = 0;
                                    c[w >> 2] = aa;
                                    if (Y) Y = 0;
                                    else {
                                        Y = (Z << 1) + (V + -2 & -2) + _ | 0;
                                        if ((Y | 0) < 0) Y = 0;
                                        else Y = (Y | 0) > 53 ? 53 : Y;
                                        Y = d[1336 + Y >> 0] | 0
                                    }
                                    c[B >> 2] = Y;
                                    ca = c[C >> 2] | 0;
                                    Y = c[ca + 32 >> 2] | 0;
                                    da = $(Y, N) | 0;
                                    W = (c[ca >> 2] | 0) + ((S << c[W + 56 >> 2]) + da) | 0;
                                    if (p) {
                                        a[n >> 0] = Wb(e, S, R) | 0;
                                        a[D >> 0] = Wb(e, U, R) | 0;
                                        a[r >> 0] = Wb(e, S, N) | 0;
                                        a[Q >> 0] = Wb(e, U, N) | 0;
                                        Na[c[K >> 2] & 3](W, Y, X, w, n, r);
                                        break
                                    } else {
                                        Na[c[L >> 2] & 3](W, Y, X, w, n, r);
                                        break
                                    }
                                }
                            while (0);
                            S = S + 8 | 0
                        } while ((S | 0) < (z | 0));
                        S = V
                    }
                    N = N + 8 | 0
                } while ((N | 0) < (t | 0));
                J = c[l >> 2] | 0
            } else S = m;
            if (c[J + 4 >> 2] | 0) {
                C = q ? v : m;
                F = e + 5840 | 0;
                D = e + 7572 | 0;
                v = e + 7568 | 0;
                x = o + 4 | 0;
                w = e + 160 | 0;
                B = n + 1 | 0;
                A = r + 1 | 0;
                G = e + 7552 | 0;
                E = e + 7536 | 0;
                H = e + 7576 | 0;
                z = e + 7556 | 0;
                y = e + 7540 | 0;
                I = 1;
                do {
                    O = 1 << c[J + (I << 2) + 13168 >> 2];
                    P = 1 << c[J + (I << 2) + 13180 >> 2];
                    if (u) {
                        N = O << 3;
                        L = q ? f : N;
                        K = (L | 0) < (s | 0);
                        J = P << 3;
                        M = q ? f - N | 0 : 0;
                        O = O << 2;
                        P = P << 2;
                        Q = g;
                        do {
                            if (K) {
                                R = Q + P | 0;
                                T = L;
                                do {
                                    W = c[F >> 2] | 0;
                                    Y = ($(W, Q) | 0) + T >> 2;
                                    da = c[H >> 2] | 0;
                                    Y = (a[da + Y >> 0] | 0) == 2;
                                    W = (a[da + (($(W, R) | 0) + T >> 2) >> 0] | 0) == 2;
                                    do
                                        if (Y | W) {
                                            U = T + -1 | 0;
                                            V = c[l >> 2] | 0;
                                            da = c[V + 13064 >> 2] | 0;
                                            _ = U >> da;
                                            X = c[V + 13140 >> 2] | 0;
                                            Z = $(Q >> da, X) | 0;
                                            aa = c[v >> 2] | 0;
                                            ba = T >> da;
                                            X = $(R >> da, X) | 0;
                                            X = (a[aa + (X + _) >> 0] | 0) + 1 + (a[aa + (X + ba) >> 0] | 0) >> 1;
                                            if (Y) Y = Xb(e, (a[aa + (Z + ba) >> 0] | 0) + 1 + (a[aa + (Z + _) >> 0] | 0) >> 1, I, S) | 0;
                                            else Y = 0;
                                            c[o >> 2] = Y;
                                            if (W) W = Xb(e, X, I, S) | 0;
                                            else W = 0;
                                            c[x >> 2] = W;
                                            ca = c[w >> 2] | 0;
                                            W = c[ca + (I << 2) + 32 >> 2] | 0;
                                            da = $(W, Q >> c[V + (I << 2) + 13180 >> 2]) | 0;
                                            V = (c[ca + (I << 2) >> 2] | 0) + ((T >> c[V + (I << 2) + 13168 >> 2] << c[V + 56 >> 2]) + da) | 0;
                                            if (p) {
                                                a[n >> 0] = Wb(e, U, Q) | 0;
                                                a[B >> 0] = Wb(e, U, R) | 0;
                                                a[r >> 0] = Wb(e, T, Q) | 0;
                                                a[A >> 0] = Wb(e, T, R) | 0;
                                                Da[c[z >> 2] & 3](V, W, o, n, r);
                                                break
                                            } else {
                                                Da[c[y >> 2] & 3](V, W, o, n, r);
                                                break
                                            }
                                        }
                                    while (0);
                                    T = T + N | 0
                                } while ((T | 0) < (s | 0))
                            }
                            if (Q) {
                                U = s - ((s | 0) == (c[(c[l >> 2] | 0) + 13120 >> 2] | 0) ? 0 : N) | 0;
                                if ((M | 0) < (U | 0)) {
                                    T = Q + -1 | 0;
                                    S = M;
                                    do {
                                        W = $(c[F >> 2] | 0, Q) | 0;
                                        da = c[D >> 2] | 0;
                                        R = S + O | 0;
                                        X = (a[da + (W + S >> 2) >> 0] | 0) == 2;
                                        W = (a[da + (W + R >> 2) >> 0] | 0) == 2;
                                        do
                                            if (X | W) {
                                                if (X) {
                                                    da = c[l >> 2] | 0;
                                                    ca = c[da + 13064 >> 2] | 0;
                                                    Y = S >> ca;
                                                    da = c[da + 13140 >> 2] | 0;
                                                    aa = ($(T >> ca, da) | 0) + Y | 0;
                                                    ba = c[v >> 2] | 0;
                                                    Y = (a[ba + aa >> 0] | 0) + 1 + (a[ba + (($(Q >> ca, da) | 0) + Y) >> 0] | 0) >> 1
                                                } else Y = 0;
                                                if (W) {
                                                    da = c[l >> 2] | 0;
                                                    ca = c[da + 13064 >> 2] | 0;
                                                    V = R >> ca;
                                                    da = c[da + 13140 >> 2] | 0;
                                                    aa = ($(T >> ca, da) | 0) + V | 0;
                                                    ba = c[v >> 2] | 0;
                                                    V = (a[ba + aa >> 0] | 0) + 1 + (a[ba + (($(Q >> ca, da) | 0) + V) >> 0] | 0) >> 1
                                                } else V = 0;
                                                if (X) X = Xb(e, Y, I, C) | 0;
                                                else X = 0;
                                                c[o >> 2] = X;
                                                if (W) V = Xb(e, V, I, m) | 0;
                                                else V = 0;
                                                c[x >> 2] = V;
                                                da = c[l >> 2] | 0;
                                                ca = c[w >> 2] | 0;
                                                V = c[ca + (I << 2) + 32 >> 2] | 0;
                                                W = $(V, Q >> c[da + 13184 >> 2]) | 0;
                                                W = (c[ca + (I << 2) >> 2] | 0) + ((S >> c[da + 13172 >> 2] << c[da + 56 >> 2]) + W) | 0;
                                                if (p) {
                                                    a[n >> 0] = Wb(e, S, T) | 0;
                                                    a[B >> 0] = Wb(e, R, T) | 0;
                                                    a[r >> 0] = Wb(e, S, Q) | 0;
                                                    a[A >> 0] = Wb(e, R, Q) | 0;
                                                    Da[c[G >> 2] & 3](W, V, o, n, r);
                                                    break
                                                } else {
                                                    Da[c[E >> 2] & 3](W, V, o, n, r);
                                                    break
                                                }
                                            }
                                        while (0);
                                        S = S + N | 0
                                    } while ((S | 0) < (U | 0));
                                    S = C
                                } else S = C
                            }
                            Q = Q + J | 0
                        } while ((Q | 0) < (t | 0))
                    }
                    I = I + 1 | 0;
                    J = c[l >> 2] | 0
                } while ((I | 0) != 3)
            }
            if (!(a[J + 12941 >> 0] | 0)) {
                if ((a[e + 140 >> 0] & 1) == 0 | k ^ 1) {
                    i = j;
                    return
                }
                i = j;
                return
            }
            n = (c[J + 13124 >> 2] | 0) - h | 0;
            l = (g | 0) == 0;
            m = (f | 0) == 0;
            if (!(l | m)) Sb(e, f - h | 0, g - h | 0);
            n = (n | 0) > (g | 0);
            if (!(m | n)) Sb(e, f - h | 0, g);
            k = k ^ 1;
            !(l | k) ? (Sb(e, f, g - h | 0), (a[e + 140 >> 0] & 1) != 0) : 0;
            if (n | k) {
                i = j;
                return
            }
            Sb(e, f, g);
            if (!(a[e + 140 >> 0] & 1)) {
                i = j;
                return
            }
            i = j;
            return
        }

        function Sb(e, f, g) {
            e = e | 0;
            f = f | 0;
            g = g | 0;
            var h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                D = 0,
                E = 0,
                F = 0,
                G = 0,
                H = 0,
                I = 0,
                J = 0,
                K = 0,
                L = 0,
                M = 0,
                N = 0,
                O = 0,
                P = 0,
                Q = 0,
                R = 0,
                S = 0,
                T = 0,
                U = 0,
                V = 0,
                W = 0,
                X = 0,
                Y = 0,
                Z = 0,
                _ = 0,
                aa = 0,
                ba = 0,
                ca = 0,
                da = 0,
                ea = 0,
                fa = 0,
                ga = 0,
                ha = 0,
                ia = 0,
                ja = 0,
                ka = 0,
                la = 0,
                ma = 0,
                na = 0,
                oa = 0,
                pa = 0;
            h = i;
            i = i + 48 | 0;
            l = h + 24 | 0;
            r = h + 42 | 0;
            s = h + 40 | 0;
            p = h + 16 | 0;
            k = h + 8 | 0;
            t = h;
            o = e + 200 | 0;
            S = c[o >> 2] | 0;
            y = c[S + 13080 >> 2] | 0;
            j = f >> y;
            y = g >> y;
            G = S + 13128 | 0;
            n = ($(y, c[G >> 2] | 0) | 0) + j | 0;
            M = c[e + 204 >> 2] | 0;
            L = M + 1668 | 0;
            N = c[(c[L >> 2] | 0) + (n << 2) >> 2] | 0;
            A = e + 3492 | 0;
            m = c[A >> 2] | 0;
            q = m + (n * 148 | 0) | 0;
            b[r >> 1] = 0;
            b[s >> 1] = 0;
            c[p >> 2] = 0;
            F = ($(c[G >> 2] | 0, y) | 0) + j | 0;
            F = a[(c[e + 7604 >> 2] | 0) + F >> 0] | 0;
            if ((a[M + 42 >> 0] | 0) != 0 ? (a[M + 53 >> 0] | 0) == 0 : 0) {
                R = 1;
                O = 1
            } else {
                R = F << 24 >> 24 == 0 & 1;
                O = 0
            }
            D = (j | 0) == 0;
            c[l >> 2] = D & 1;
            I = (y | 0) == 0;
            u = l + 4 | 0;
            c[u >> 2] = I & 1;
            H = (j | 0) == ((c[G >> 2] | 0) + -1 | 0);
            z = l + 8 | 0;
            c[z >> 2] = H & 1;
            E = (y | 0) == ((c[S + 13132 >> 2] | 0) + -1 | 0);
            x = l + 12 | 0;
            c[x >> 2] = E & 1;
            if (R << 24 >> 24) {
                if (D) J = 0;
                else {
                    if (O) {
                        J = c[M + 1676 >> 2] | 0;
                        J = (c[J + (N << 2) >> 2] | 0) != (c[J + (c[(c[L >> 2] | 0) + (n + -1 << 2) >> 2] << 2) >> 2] | 0) & 1
                    } else J = 0;
                    if (F << 24 >> 24 == 0 ? (pa = $(c[G >> 2] | 0, y) | 0, oa = c[e + 7580 >> 2] | 0, (c[oa + (pa + j << 2) >> 2] | 0) != (c[oa + (j + -1 + pa << 2) >> 2] | 0)) : 0) K = 1;
                    else K = J;
                    a[r >> 0] = K
                }
                if (H) K = 0;
                else {
                    if (O) {
                        K = c[M + 1676 >> 2] | 0;
                        K = (c[K + (N << 2) >> 2] | 0) != (c[K + (c[(c[L >> 2] | 0) + (n + 1 << 2) >> 2] << 2) >> 2] | 0) & 1
                    } else K = 0;
                    if (F << 24 >> 24 == 0 ? (pa = $(c[G >> 2] | 0, y) | 0, oa = c[e + 7580 >> 2] | 0, (c[oa + (pa + j << 2) >> 2] | 0) != (c[oa + (j + 1 + pa << 2) >> 2] | 0)) : 0) P = 1;
                    else P = K;
                    a[r + 1 >> 0] = P
                }
                if (I) P = 0;
                else {
                    if (O) {
                        P = c[M + 1676 >> 2] | 0;
                        P = (c[P + (N << 2) >> 2] | 0) != (c[P + (c[(c[L >> 2] | 0) + (n - (c[G >> 2] | 0) << 2) >> 2] << 2) >> 2] | 0) & 1
                    } else P = 0;
                    if (F << 24 >> 24 == 0 ? (pa = c[G >> 2] | 0, na = ($(pa, y) | 0) + j | 0, oa = c[e + 7580 >> 2] | 0, (c[oa + (na << 2) >> 2] | 0) != (c[oa + (($(pa, y + -1 | 0) | 0) + j << 2) >> 2] | 0)) : 0) Q = 1;
                    else Q = P;
                    a[s >> 0] = Q
                }
                if (E) L = 0;
                else {
                    if (O) {
                        pa = c[M + 1676 >> 2] | 0;
                        L = (c[pa + (N << 2) >> 2] | 0) != (c[pa + (c[(c[L >> 2] | 0) + ((c[G >> 2] | 0) + n << 2) >> 2] << 2) >> 2] | 0) & 1
                    } else L = 0;
                    if (F << 24 >> 24 == 0 ? (pa = c[G >> 2] | 0, na = ($(pa, y) | 0) + j | 0, oa = c[e + 7580 >> 2] | 0, (c[oa + (na << 2) >> 2] | 0) != (c[oa + (($(pa, y + 1 | 0) | 0) + j << 2) >> 2] | 0)) : 0) M = 1;
                    else M = L;
                    a[s + 1 >> 0] = M
                }
                if (!D)
                    if (I) B = 47;
                    else {
                        if (!(F << 24 >> 24)) {
                            pa = c[G >> 2] | 0;
                            na = ($(pa, y) | 0) + j | 0;
                            oa = c[e + 7580 >> 2] | 0;
                            if (J << 24 >> 24 == 0 ? (c[oa + (na << 2) >> 2] | 0) == (c[oa + (j + -1 + ($(pa, y + -1 | 0) | 0) << 2) >> 2] | 0) : 0) B = 38;
                            else M = 1
                        } else if (!(J << 24 >> 24)) B = 38;
                        else M = 1;
                        if ((B | 0) == 38) M = P << 24 >> 24 != 0 & 1;
                        a[p >> 0] = M;
                        B = 40
                    } else B = 40;
                if ((B | 0) == 40)
                    if (!I) {
                        if (!H) {
                            if (!(F << 24 >> 24)) {
                                pa = c[G >> 2] | 0;
                                na = ($(pa, y) | 0) + j | 0;
                                oa = c[e + 7580 >> 2] | 0;
                                if (K << 24 >> 24 == 0 ? (c[oa + (na << 2) >> 2] | 0) == (c[oa + (j + 1 + ($(pa, y + -1 | 0) | 0) << 2) >> 2] | 0) : 0) B = 45;
                                else I = 1
                            } else if (!(K << 24 >> 24)) B = 45;
                            else I = 1;
                            if ((B | 0) == 45) I = P << 24 >> 24 != 0 & 1;
                            a[p + 1 >> 0] = I;
                            B = 47
                        }
                    } else B = 47;
                if ((B | 0) == 47 ? !(H | E) : 0) {
                    if (!(F << 24 >> 24)) {
                        pa = c[G >> 2] | 0;
                        na = ($(pa, y) | 0) + j | 0;
                        oa = c[e + 7580 >> 2] | 0;
                        if (K << 24 >> 24 == 0 ? (c[oa + (na << 2) >> 2] | 0) == (c[oa + (j + 1 + ($(pa, y + 1 | 0) | 0) << 2) >> 2] | 0) : 0) B = 51;
                        else H = 1
                    } else if (!(K << 24 >> 24)) B = 51;
                    else H = 1;
                    if ((B | 0) == 51) H = L << 24 >> 24 != 0 & 1;
                    a[p + 2 >> 0] = H
                }
                if (!(D | E)) {
                    if (!(F << 24 >> 24)) {
                        pa = c[G >> 2] | 0;
                        na = ($(pa, y) | 0) + j | 0;
                        oa = c[e + 7580 >> 2] | 0;
                        if (J << 24 >> 24 == 0 ? (c[oa + (na << 2) >> 2] | 0) == (c[oa + (j + -1 + ($(pa, y + 1 | 0) | 0) << 2) >> 2] | 0) : 0) B = 57;
                        else D = 1
                    } else if (!(J << 24 >> 24)) B = 57;
                    else D = 1;
                    if ((B | 0) == 57) D = L << 24 >> 24 != 0 & 1;
                    a[p + 3 >> 0] = D
                }
            }
            N = (c[S + 4 >> 2] | 0) != 0 ? 3 : 1;
            E = e + 160 | 0;
            D = e + 168 | 0;
            F = e + 5916 | 0;
            P = y << 1;
            H = P + -1 | 0;
            G = k + 4 | 0;
            O = y + -1 | 0;
            J = j + 1 | 0;
            L = j + -1 | 0;
            P = P + 2 | 0;
            Q = t + 4 | 0;
            M = y + 1 | 0;
            I = j << 1;
            K = I + -1 | 0;
            I = I + 2 | 0;
            R = e + ((R & 255) << 2) + 5920 | 0;
            na = S;
            _ = 0;
            while (1) {
                ka = c[na + (_ << 2) + 13168 >> 2] | 0;
                V = f >> ka;
                ha = c[na + (_ << 2) + 13180 >> 2] | 0;
                aa = g >> ha;
                ba = c[E >> 2] | 0;
                W = c[ba + (_ << 2) + 32 >> 2] | 0;
                S = 1 << c[na + 13080 >> 2];
                Z = S >> ka;
                Y = S >> ha;
                ka = c[na + 13120 >> 2] >> ka;
                ca = ka - V | 0;
                Z = (Z | 0) > (ca | 0) ? ca : Z;
                ha = c[na + 13124 >> 2] >> ha;
                ca = ha - aa | 0;
                Y = (Y | 0) > (ca | 0) ? ca : Y;
                ca = $(W, aa) | 0;
                fa = c[na + 56 >> 2] | 0;
                ca = (V << fa) + ca | 0;
                ba = c[ba + (_ << 2) >> 2] | 0;
                X = ba + ca | 0;
                S = S + 2 << fa;
                ea = c[D >> 2] | 0;
                ga = 1 << fa;
                da = S + ga | 0;
                U = ea + da | 0;
                T = m + (n * 148 | 0) + _ + 142 | 0;
                ia = d[T >> 0] | 0;
                if ((ia | 0) == 2) {
                    ja = c[l >> 2] | 0;
                    ia = c[z >> 2] | 0;
                    la = c[x >> 2] | 0;
                    do
                        if (!(c[u >> 2] | 0)) {
                            pa = 1 - ja | 0;
                            oa = pa << fa;
                            ma = ga - oa | 0;
                            c[k >> 2] = ba + (ca - W - oa);
                            c[G >> 2] = (c[e + (_ << 2) + 172 >> 2] | 0) + (($(ka, H) | 0) + V - pa << fa);
                            do
                                if ((ja | 0) != 1) {
                                    oa = ea + ma | 0;
                                    pa = L + ($(c[na + 13128 >> 2] | 0, O) | 0) | 0;
                                    pa = c[k + (((a[(c[A >> 2] | 0) + (pa * 148 | 0) + _ + 142 >> 0] | 0) == 3 & 1) << 2) >> 2] | 0;
                                    if (!fa) {
                                        a[oa >> 0] = a[pa >> 0] | 0;
                                        na = c[o >> 2] | 0;
                                        oa = ga;
                                        break
                                    } else {
                                        b[oa >> 1] = b[pa >> 1] | 0;
                                        oa = ga;
                                        break
                                    }
                                } else oa = 0;
                            while (0);
                            pa = ($(c[na + 13128 >> 2] | 0, O) | 0) + j | 0;
                            na = Z << fa;
                            mf(ea + (oa + ma) | 0, (c[k + (((a[(c[A >> 2] | 0) + (pa * 148 | 0) + _ + 142 >> 0] | 0) == 3 & 1) << 2) >> 2] | 0) + oa | 0, na | 0) | 0;
                            if ((ia | 0) != 1) {
                                pa = oa + na | 0;
                                oa = J + ($(c[(c[o >> 2] | 0) + 13128 >> 2] | 0, O) | 0) | 0;
                                na = ea + (pa + ma) | 0;
                                ma = (c[k + (((a[(c[A >> 2] | 0) + (oa * 148 | 0) + _ + 142 >> 0] | 0) == 3 & 1) << 2) >> 2] | 0) + pa | 0;
                                if (!fa) {
                                    a[na >> 0] = a[ma >> 0] | 0;
                                    break
                                } else {
                                    b[na >> 1] = b[ma >> 1] | 0;
                                    break
                                }
                            }
                        }
                    while (0);
                    do
                        if (!la) {
                            pa = 1 - ja | 0;
                            oa = pa << fa;
                            la = ($(Y, S) | 0) + da - oa | 0;
                            c[t >> 2] = ba + (($(Y, W) | 0) + ca - oa);
                            c[Q >> 2] = (c[e + (_ << 2) + 172 >> 2] | 0) + (($(ka, P) | 0) + V - pa << fa);
                            do
                                if ((ja | 0) != 1) {
                                    ka = ea + la | 0;
                                    ma = L + ($(c[(c[o >> 2] | 0) + 13128 >> 2] | 0, M) | 0) | 0;
                                    ma = c[t + (((a[(c[A >> 2] | 0) + (ma * 148 | 0) + _ + 142 >> 0] | 0) == 3 & 1) << 2) >> 2] | 0;
                                    if (!fa) {
                                        a[ka >> 0] = a[ma >> 0] | 0;
                                        ma = ga;
                                        break
                                    } else {
                                        b[ka >> 1] = b[ma >> 1] | 0;
                                        ma = ga;
                                        break
                                    }
                                } else ma = 0;
                            while (0);
                            pa = ($(c[(c[o >> 2] | 0) + 13128 >> 2] | 0, M) | 0) + j | 0;
                            ka = Z << fa;
                            mf(ea + (ma + la) | 0, (c[t + (((a[(c[A >> 2] | 0) + (pa * 148 | 0) + _ + 142 >> 0] | 0) == 3 & 1) << 2) >> 2] | 0) + ma | 0, ka | 0) | 0;
                            if ((ia | 0) != 1) {
                                pa = ma + ka | 0;
                                oa = J + ($(c[(c[o >> 2] | 0) + 13128 >> 2] | 0, M) | 0) | 0;
                                ka = ea + (pa + la) | 0;
                                la = (c[t + (((a[(c[A >> 2] | 0) + (oa * 148 | 0) + _ + 142 >> 0] | 0) == 3 & 1) << 2) >> 2] | 0) + pa | 0;
                                if (!fa) {
                                    a[ka >> 0] = a[la >> 0] | 0;
                                    break
                                } else {
                                    b[ka >> 1] = b[la >> 1] | 0;
                                    break
                                }
                            }
                        }
                    while (0);
                    do
                        if (!ja) {
                            pa = L + ($(c[(c[o >> 2] | 0) + 13128 >> 2] | 0, y) | 0) | 0;
                            if ((a[(c[A >> 2] | 0) + (pa * 148 | 0) + _ + 142 >> 0] | 0) == 3) {
                                la = ea + S | 0;
                                ja = (c[e + (_ << 2) + 184 >> 2] | 0) + (($(ha, K) | 0) + aa << fa) | 0;
                                ka = (Y | 0) > 0;
                                if (!fa) {
                                    if (ka) ka = 0;
                                    else {
                                        ja = 0;
                                        break
                                    }
                                    while (1) {
                                        a[la >> 0] = a[ja >> 0] | 0;
                                        ka = ka + 1 | 0;
                                        if ((ka | 0) == (Y | 0)) {
                                            ja = 0;
                                            break
                                        } else {
                                            la = la + S | 0;
                                            ja = ja + ga | 0
                                        }
                                    }
                                } else {
                                    if (ka) ka = 0;
                                    else {
                                        ja = 0;
                                        break
                                    }
                                    while (1) {
                                        b[la >> 1] = b[ja >> 1] | 0;
                                        ka = ka + 1 | 0;
                                        if ((ka | 0) == (Y | 0)) {
                                            ja = 0;
                                            break
                                        } else {
                                            la = la + S | 0;
                                            ja = ja + ga | 0
                                        }
                                    }
                                }
                            } else ja = 1
                        } else ja = 0;
                    while (0);
                    do
                        if (!ia) {
                            pa = J + ($(c[(c[o >> 2] | 0) + 13128 >> 2] | 0, y) | 0) | 0;
                            if ((a[(c[A >> 2] | 0) + (pa * 148 | 0) + _ + 142 >> 0] | 0) == 3) {
                                ia = ea + ((Z << fa) + da) | 0;
                                ha = (c[e + (_ << 2) + 184 >> 2] | 0) + (($(ha, I) | 0) + aa << fa) | 0;
                                ka = (Y | 0) > 0;
                                if (!fa) {
                                    if (ka) B = 0;
                                    else break;
                                    while (1) {
                                        a[ia >> 0] = a[ha >> 0] | 0;
                                        B = B + 1 | 0;
                                        if ((B | 0) == (Y | 0)) {
                                            C = 0;
                                            B = 96;
                                            break
                                        } else {
                                            ia = ia + S | 0;
                                            ha = ha + ga | 0
                                        }
                                    }
                                } else {
                                    if (ka) B = 0;
                                    else break;
                                    while (1) {
                                        b[ia >> 1] = b[ha >> 1] | 0;
                                        B = B + 1 | 0;
                                        if ((B | 0) == (Y | 0)) {
                                            C = 0;
                                            B = 96;
                                            break
                                        } else {
                                            ia = ia + S | 0;
                                            ha = ha + ga | 0
                                        }
                                    }
                                }
                            } else {
                                C = 1;
                                B = 96
                            }
                        } else {
                            C = 0;
                            B = 96
                        }
                    while (0);
                    if ((B | 0) == 96 ? (B = 0, v = ja << fa, w = ja + Z + C << fa, (Y | 0) > 0) : 0) {
                        da = ea + (da - v) | 0;
                        ea = 0;
                        ba = ba + (ca - v) | 0;
                        while (1) {
                            mf(da | 0, ba | 0, w | 0) | 0;
                            ea = ea + 1 | 0;
                            if ((ea | 0) == (Y | 0)) break;
                            else {
                                da = da + S | 0;
                                ba = ba + W | 0
                            }
                        }
                    }
                    Ub(e, X, W, V, aa, Z, Y, _, j, y);
                    Ia[c[R >> 2] & 3](X, U, W, S, q, l, Z, Y, _, r, s, p);
                    Vb(e, X, U, W, S, f, g, Z, Y, _);
                    a[T >> 0] = 3
                } else if ((ia | 0) == 1) {
                    ca = Z << fa;
                    if ((Y | 0) > 0) {
                        ba = U;
                        da = 0;
                        ea = X;
                        while (1) {
                            mf(ba | 0, ea | 0, ca | 0) | 0;
                            da = da + 1 | 0;
                            if ((da | 0) == (Y | 0)) break;
                            else {
                                ba = ba + S | 0;
                                ea = ea + W | 0
                            }
                        }
                    }
                    Ub(e, X, W, V, aa, Z, Y, _, j, y);
                    Ha[c[F >> 2] & 1](X, U, W, S, q, l, Z, Y, _);
                    Vb(e, X, U, W, S, f, g, Z, Y, _);
                    a[T >> 0] = 3
                }
                _ = _ + 1 | 0;
                if ((_ | 0) >= (N | 0)) break;
                na = c[o >> 2] | 0
            }
            i = h;
            return
        }

        function Tb(a, b, d, e) {
            a = a | 0;
            b = b | 0;
            d = d | 0;
            e = e | 0;
            var f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0;
            f = i;
            h = c[a + 200 >> 2] | 0;
            k = ((c[h + 13120 >> 2] | 0) - e | 0) > (b | 0);
            h = ((c[h + 13124 >> 2] | 0) - e | 0) > (d | 0);
            j = (d | 0) == 0;
            g = (b | 0) == 0;
            if (!(j | g)) Rb(a, b - e | 0, d - e | 0, e);
            if (!(j | k)) Rb(a, b, d - e | 0, e);
            if (g | h) {
                i = f;
                return
            }
            Rb(a, b - e | 0, d, e);
            i = f;
            return
        }

        function Ub(d, e, f, g, h, j, k, l, m, n) {
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            m = m | 0;
            n = n | 0;
            var o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0;
            o = i;
            q = c[d + 200 >> 2] | 0;
            p = c[q + 56 >> 2] | 0;
            s = c[q + 13120 >> 2] >> c[q + (l << 2) + 13168 >> 2];
            q = c[q + 13124 >> 2] >> c[q + (l << 2) + 13180 >> 2];
            u = d + (l << 2) + 172 | 0;
            t = n << 1;
            r = j << p;
            mf((c[u >> 2] | 0) + (($(s, t) | 0) + g << p) | 0, e | 0, r | 0) | 0;
            mf((c[u >> 2] | 0) + (($(s, t | 1) | 0) + g << p) | 0, e + ($(k + -1 | 0, f) | 0) | 0, r | 0) | 0;
            d = d + (l << 2) + 184 | 0;
            r = c[d >> 2] | 0;
            l = m << 1;
            t = r + (($(q, l) | 0) + h << p) | 0;
            m = 1 << p;
            n = (p | 0) == 0;
            g = (k | 0) > 0;
            if (n) {
                if (g) {
                    r = t;
                    t = 0;
                    s = e;
                    while (1) {
                        a[r >> 0] = a[s >> 0] | 0;
                        t = t + 1 | 0;
                        if ((t | 0) == (k | 0)) break;
                        else {
                            r = r + m | 0;
                            s = s + f | 0
                        }
                    }
                    r = c[d >> 2] | 0
                }
            } else if (g) {
                d = 0;
                s = e;
                while (1) {
                    b[t >> 1] = b[s >> 1] | 0;
                    d = d + 1 | 0;
                    if ((d | 0) == (k | 0)) break;
                    else {
                        t = t + m | 0;
                        s = s + f | 0
                    }
                }
            }
            h = r + (($(q, l | 1) | 0) + h << p) | 0;
            j = e + (j + -1 << p) | 0;
            if (n) {
                if (g) p = 0;
                else {
                    i = o;
                    return
                }
                while (1) {
                    a[h >> 0] = a[j >> 0] | 0;
                    p = p + 1 | 0;
                    if ((p | 0) == (k | 0)) break;
                    else {
                        h = h + m | 0;
                        j = j + f | 0
                    }
                }
                i = o;
                return
            } else {
                if (g) p = 0;
                else {
                    i = o;
                    return
                }
                while (1) {
                    b[h >> 1] = b[j >> 1] | 0;
                    p = p + 1 | 0;
                    if ((p | 0) == (k | 0)) break;
                    else {
                        h = h + m | 0;
                        j = j + f | 0
                    }
                }
                i = o;
                return
            }
        }

        function Vb(b, d, e, f, g, h, j, k, l, m) {
            b = b | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            m = m | 0;
            var n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0;
            n = i;
            t = c[b + 200 >> 2] | 0;
            if (!(a[(c[b + 204 >> 2] | 0) + 40 >> 0] | 0)) {
                if (!(a[t + 13056 >> 0] | 0)) {
                    i = n;
                    return
                }
                if (!(c[t + 68 >> 2] | 0)) {
                    i = n;
                    return
                }
            }
            p = b + 200 | 0;
            C = c[t + 13084 >> 2] | 0;
            v = 1 << C;
            o = c[t + (m << 2) + 13168 >> 2] | 0;
            s = c[t + (m << 2) + 13180 >> 2] | 0;
            m = h >> C;
            z = j >> C;
            k = k + h >> C;
            l = l + j >> C;
            t = v >> o << c[t + 56 >> 2];
            if ((z | 0) >= (l | 0)) {
                i = n;
                return
            }
            u = (m | 0) < (k | 0);
            b = b + 7600 | 0;
            v = v >> s;
            w = (v | 0) > 0;
            do {
                if (u) {
                    x = z - j | 0;
                    y = m;
                    do {
                        A = c[p >> 2] | 0;
                        C = ($(c[A + 13156 >> 2] | 0, z) | 0) + y | 0;
                        if ((a[(c[b >> 2] | 0) + C >> 0] | 0) != 0 ? (r = c[A + 13084 >> 2] | 0, q = x << r >> s, r = y - h << r >> o << c[A + 56 >> 2], w) : 0) {
                            C = e + (($(q, g) | 0) + r) | 0;
                            A = 0;
                            B = d + (($(q, f) | 0) + r) | 0;
                            while (1) {
                                mf(B | 0, C | 0, t | 0) | 0;
                                A = A + 1 | 0;
                                if ((A | 0) == (v | 0)) break;
                                else {
                                    C = C + g | 0;
                                    B = B + f | 0
                                }
                            }
                        }
                        y = y + 1 | 0
                    } while ((y | 0) != (k | 0))
                }
                z = z + 1 | 0
            } while ((z | 0) != (l | 0));
            i = n;
            return
        }

        function Wb(a, b, e) {
            a = a | 0;
            b = b | 0;
            e = e | 0;
            var f = 0,
                g = 0,
                h = 0;
            f = i;
            g = c[a + 200 >> 2] | 0;
            h = c[g + 13084 >> 2] | 0;
            if ((e | b | 0) < 0) {
                e = 2;
                i = f;
                return e | 0
            }
            b = b >> h;
            e = e >> h;
            h = c[g + 13156 >> 2] | 0;
            if ((b | 0) >= (h | 0)) {
                e = 2;
                i = f;
                return e | 0
            }
            if ((e | 0) >= (c[g + 13160 >> 2] | 0)) {
                e = 2;
                i = f;
                return e | 0
            }
            e = ($(h, e) | 0) + b | 0;
            e = d[(c[a + 7600 >> 2] | 0) + e >> 0] | 0;
            i = f;
            return e | 0
        }

        function Xb(b, e, f, g) {
            b = b | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            var h = 0,
                j = 0;
            h = i;
            j = c[b + 204 >> 2] | 0;
            e = (c[((f | 0) == 1 ? j + 28 | 0 : j + 32 | 0) >> 2] | 0) + e | 0;
            if ((e | 0) < 0) e = 0;
            else e = (e | 0) > 57 ? 57 : e;
            do
                if ((c[(c[b + 200 >> 2] | 0) + 4 >> 2] | 0) == 1) {
                    if ((e | 0) >= 30)
                        if ((e | 0) > 43) {
                            e = e + -6 | 0;
                            break
                        } else {
                            e = d[1392 + (e + -30) >> 0] | 0;
                            break
                        }
                } else if ((e | 0) < 0) e = 0;
            else e = (e | 0) > 51 ? 51 : e;
            while (0);
            g = g + 2 + e | 0;
            if ((g | 0) < 0) {
                j = 0;
                j = 1336 + j | 0;
                j = a[j >> 0] | 0;
                j = j & 255;
                i = h;
                return j | 0
            }
            j = (g | 0) > 53 ? 53 : g;
            j = 1336 + j | 0;
            j = a[j >> 0] | 0;
            j = j & 255;
            i = h;
            return j | 0
        }

        function Yb(b, d, e, f) {
            b = b | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            var g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0;
            g = i;
            k = b + 7628 | 0;
            c[k >> 2] = 0;
            a: do
                if ((e | 0) > 1) {
                    m = 0;
                    while (1) {
                        if (!(a[d + m >> 0] | 0)) {
                            if ((m | 0) > 0) {
                                l = m + -1 | 0;
                                l = (a[d + l >> 0] | 0) == 0 ? l : m
                            } else l = m;
                            m = l + 2 | 0;
                            if (((m | 0) < (e | 0) ? (a[d + (l + 1) >> 0] | 0) == 0 : 0) ? (j = a[d + m >> 0] | 0, (j & 255) < 4) : 0) break
                        } else l = m;
                        m = l + 2 | 0;
                        if ((l + 3 | 0) >= (e | 0)) break a
                    }
                    m = l;
                    e = j << 24 >> 24 == 3 ? e : l
                } else m = 0;
            while (0);
            if ((m | 0) >= (e + -1 | 0)) {
                c[f + 12 >> 2] = d;
                c[f + 8 >> 2] = e;
                q = e;
                i = g;
                return q | 0
            }
            me(f, f + 4 | 0, e + 32 | 0);
            j = c[f >> 2] | 0;
            if (!j) {
                q = -12;
                i = g;
                return q | 0
            }
            mf(j | 0, d | 0, m | 0) | 0;
            o = m + 2 | 0;
            b: do
                if ((o | 0) < (e | 0)) {
                    l = b + 7636 | 0;
                    b = b + 7632 | 0;
                    n = m;
                    c: while (1) {
                        p = d + o | 0;
                        q = a[p >> 0] | 0;
                        do
                            if ((q & 255) <= 3) {
                                p = a[d + m >> 0] | 0;
                                if (!(p << 24 >> 24))
                                    if (!(a[d + (m + 1) >> 0] | 0)) {
                                        if (q << 24 >> 24 != 3) {
                                            e = m;
                                            break b
                                        }
                                        o = n + 1 | 0;
                                        a[j + n >> 0] = 0;
                                        n = n + 2 | 0;
                                        a[j + o >> 0] = 0;
                                        m = m + 3 | 0;
                                        q = (c[k >> 2] | 0) + 1 | 0;
                                        c[k >> 2] = q;
                                        p = c[l >> 2] | 0;
                                        if ((p | 0) < (q | 0)) {
                                            p = p << 1;
                                            c[l >> 2] = p;
                                            ke(b, p, 4) | 0;
                                            p = c[b >> 2] | 0;
                                            if (!p) {
                                                f = -12;
                                                break c
                                            }
                                        } else {
                                            p = c[b >> 2] | 0;
                                            if (!p) break
                                        }
                                        c[p + ((c[k >> 2] | 0) + -1 << 2) >> 2] = o
                                    } else {
                                        p = 0;
                                        h = 26
                                    } else h = 26
                            } else {
                                a[j + n >> 0] = a[d + m >> 0] | 0;
                                a[j + (n + 1) >> 0] = a[d + (m + 1) >> 0] | 0;
                                p = a[p >> 0] | 0;
                                n = n + 2 | 0;
                                m = o;
                                h = 26
                            }
                        while (0);
                        if ((h | 0) == 26) {
                            h = 0;
                            a[j + n >> 0] = p;
                            n = n + 1 | 0;
                            m = m + 1 | 0
                        }
                        o = m + 2 | 0;
                        if ((o | 0) >= (e | 0)) {
                            h = 15;
                            break b
                        }
                    }
                    i = g;
                    return f | 0
                } else {
                    n = m;
                    h = 15
                }
            while (0);
            if ((h | 0) == 15)
                if ((m | 0) < (e | 0)) {
                    h = e + n | 0;
                    k = m;
                    while (1) {
                        a[j + n >> 0] = a[d + k >> 0] | 0;
                        k = k + 1 | 0;
                        if ((k | 0) == (e | 0)) break;
                        else n = n + 1 | 0
                    }
                    n = h - m | 0
                } else e = m;
            h = j + n + 0 | 0;
            d = h + 32 | 0;
            do {
                a[h >> 0] = 0;
                h = h + 1 | 0
            } while ((h | 0) < (d | 0));
            c[f + 12 >> 2] = j;
            c[f + 8 >> 2] = n;
            q = e;
            i = g;
            return q | 0
        }

        function Zb(b) {
            b = b | 0;
            var d = 0,
                e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0;
            d = i;
            f = b + 60 | 0;
            e = c[f >> 2] | 0;
            Wd();
            Cc();
            f = c[f >> 2] | 0;
            c[f + 4 >> 2] = b;
            g = le(31328) | 0;
            c[f + 136 >> 2] = g;
            a: do
                if (((g | 0) != 0 ? (c[f + 72 >> 2] = g, c[f + 8 >> 2] = f, j = ee(199) | 0, c[f + 152 >> 2] = j, (j | 0) != 0) : 0) ? (j = Be() | 0, c[f + 164 >> 2] = j, (j | 0) != 0) : 0) {
                    g = f + 3512 | 0;
                    h = 0;
                    do {
                        j = Be() | 0;
                        c[g + (h * 72 | 0) >> 2] = j;
                        if (!j) break a;
                        c[g + (h * 72 | 0) + 4 >> 2] = j;
                        h = h + 1 | 0
                    } while (h >>> 0 < 32);
                    c[f + 5836 >> 2] = 2147483647;
                    a[f + 7721 >> 0] = 1;
                    c[f + 5828 >> 2] = 0;
                    c[e + 7620 >> 2] = 0;
                    c[e + 7772 >> 2] = 0;
                    f = b + 808 | 0;
                    if (!(c[f >> 2] & 2)) a[e + 141 >> 0] = 1;
                    else a[e + 141 >> 0] = c[b + 800 >> 2];
                    if ((c[f >> 2] & 1 | 0) != 0 ? (c[b + 800 >> 2] | 0) > 1 : 0) {
                        a[e + 140 >> 0] = 1;
                        j = 0;
                        i = d;
                        return j | 0
                    }
                    a[e + 140 >> 0] = 2;
                    j = 0;
                    i = d;
                    return j | 0
                }
            while (0);
            $b(b) | 0;
            j = -12;
            i = d;
            return j | 0
        }

        function _b(f, g, h, j) {
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            var k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                E = 0,
                F = 0,
                G = 0,
                H = 0,
                I = 0,
                J = 0,
                K = 0,
                L = 0,
                M = 0,
                N = 0,
                O = 0,
                P = 0,
                Q = 0,
                R = 0,
                S = 0,
                T = 0,
                U = 0,
                V = 0,
                W = 0,
                X = 0,
                Y = 0,
                Z = 0,
                _ = 0,
                aa = 0,
                ba = 0,
                ca = 0,
                da = 0,
                ea = 0,
                fa = 0,
                ga = 0,
                ha = 0,
                ia = 0,
                ja = 0,
                ka = 0,
                la = 0,
                ma = 0,
                na = 0,
                oa = 0,
                pa = 0,
                qa = 0,
                ra = 0,
                sa = 0,
                ta = 0,
                ua = 0,
                va = 0,
                wa = 0,
                xa = 0,
                ya = 0,
                za = 0,
                Aa = 0,
                Ba = 0,
                Ca = 0,
                Da = 0,
                Ea = 0,
                Fa = 0,
                Ha = 0,
                Ia = 0,
                Ja = 0,
                Ka = 0,
                La = 0,
                Ma = 0,
                Na = 0,
                Oa = 0,
                Pa = 0,
                Qa = 0,
                Ra = 0,
                Sa = 0,
                Ta = 0,
                Ua = 0,
                Va = 0,
                Wa = 0,
                Xa = 0,
                Ya = 0,
                Za = 0,
                _a = 0,
                $a = 0,
                ab = 0,
                bb = 0,
                cb = 0,
                db = 0,
                eb = 0,
                fb = 0,
                gb = 0,
                hb = 0,
                ib = 0,
                jb = 0,
                kb = 0,
                lb = 0,
                mb = 0,
                nb = 0,
                ob = 0,
                pb = 0,
                qb = 0;
            k = i;
            i = i + 48 | 0;
            o = k + 8 | 0;
            n = k + 32 | 0;
            r = k + 16 | 0;
            p = k;
            m = c[f + 60 >> 2] | 0;
            f = j + 28 | 0;
            L = c[f >> 2] | 0;
            if (!L) {
                g = vc(m, g, 1) | 0;
                if ((g | 0) < 0) {
                    pb = g;
                    i = k;
                    return pb | 0
                }
                c[h >> 2] = g;
                pb = 0;
                i = k;
                return pb | 0
            }
            q = m + 3508 | 0;
            c[q >> 2] = 0;
            l = m + 7776 | 0;
            b[l >> 1] = 1;
            K = c[j + 24 >> 2] | 0;
            c[q >> 2] = 0;
            G = m + 5828 | 0;
            s = m + 5832 | 0;
            c[s >> 2] = c[G >> 2];
            c[G >> 2] = 0;
            w = m + 7660 | 0;
            c[w >> 2] = 0;
            a: do
                if ((L | 0) > 3) {
                    J = m + 7722 | 0;
                    H = m + 7664 | 0;
                    A = m + 7656 | 0;
                    j = m + 7640 | 0;
                    E = m + 7648 | 0;
                    y = m + 7644 | 0;
                    F = m + 7636 | 0;
                    z = m + 7632 | 0;
                    x = m + 7628 | 0;
                    u = m + 136 | 0;
                    v = m + 3500 | 0;
                    I = m + 7732 | 0;
                    while (1) {
                        C = (a[J >> 0] | 0) == 0;
                        if (C) {
                            while (1) {
                                M = K + 1 | 0;
                                if (((a[K >> 0] | 0) == 0 ? (a[M >> 0] | 0) == 0 : 0) ? (a[K + 2 >> 0] | 0) == 1 : 0) break;
                                if ((L | 0) < 5) {
                                    C = -1094995529;
                                    break a
                                }
                                K = M;
                                L = L + -1 | 0
                            }
                            K = K + 3 | 0;
                            N = 0;
                            L = L + -3 | 0
                        } else {
                            M = c[I >> 2] | 0;
                            if ((M | 0) > 0) {
                                O = 0;
                                N = 0;
                                do {
                                    O = d[K + N >> 0] | O << 8;
                                    N = N + 1 | 0
                                } while ((N | 0) != (M | 0));
                                N = O
                            } else N = 0;
                            L = L - M | 0;
                            if ((N | 0) > (L | 0)) {
                                C = -1094995529;
                                break a
                            }
                            K = K + M | 0
                        }
                        C = C ? L : N;
                        M = c[H >> 2] | 0;
                        O = c[w >> 2] | 0;
                        if ((M | 0) < (O + 1 | 0)) {
                            M = M + 1 | 0;
                            N = je(c[A >> 2] | 0, M, 16) | 0;
                            if (!N) {
                                C = -12;
                                break a
                            }
                            c[A >> 2] = N;
                            O = c[H >> 2] | 0;
                            jf(N + (O << 4) | 0, 0, M - O << 4 | 0) | 0;
                            ke(j, M, 4) | 0;
                            ke(E, M, 4) | 0;
                            ke(y, M, 4) | 0;
                            O = c[E >> 2] | 0;
                            c[O + (c[H >> 2] << 2) >> 2] = 1024;
                            O = ne(c[O + (c[H >> 2] << 2) >> 2] | 0, 4) | 0;
                            c[(c[y >> 2] | 0) + (c[H >> 2] << 2) >> 2] = O;
                            c[H >> 2] = M;
                            O = c[w >> 2] | 0
                        }
                        c[F >> 2] = c[(c[E >> 2] | 0) + (O << 2) >> 2];
                        c[z >> 2] = c[(c[y >> 2] | 0) + (O << 2) >> 2];
                        N = c[A >> 2] | 0;
                        M = Yb(m, K, C, N + (O << 4) | 0) | 0;
                        c[(c[j >> 2] | 0) + (c[w >> 2] << 2) >> 2] = c[x >> 2];
                        c[(c[E >> 2] | 0) + (c[w >> 2] << 2) >> 2] = c[F >> 2];
                        ob = c[z >> 2] | 0;
                        pb = c[w >> 2] | 0;
                        c[w >> 2] = pb + 1;
                        c[(c[y >> 2] | 0) + (pb << 2) >> 2] = ob;
                        if ((M | 0) < 0) {
                            C = M;
                            break a
                        }
                        ob = c[u >> 2] | 0;
                        mb = c[N + (O << 4) + 12 >> 2] | 0;
                        nb = c[N + (O << 4) + 8 >> 2] | 0;
                        nb = nb >>> 0 > 268435455 ? -8 : nb << 3;
                        pb = nb >>> 0 > 2147483639 | (mb | 0) == 0;
                        nb = pb ? 0 : nb;
                        mb = pb ? 0 : mb;
                        C = pb ? -1094995529 : 0;
                        c[ob + 204 >> 2] = mb;
                        c[ob + 216 >> 2] = nb;
                        c[ob + 220 >> 2] = nb + 8;
                        c[ob + 208 >> 2] = mb + (nb >> 3);
                        c[ob + 212 >> 2] = 0;
                        if (pb) break a;
                        cc(m) | 0;
                        if (((c[v >> 2] | 0) + -36 | 0) >>> 0 < 2) c[G >> 2] = 1;
                        L = L - M | 0;
                        if ((L | 0) <= 3) break;
                        else K = K + M | 0
                    }
                    if ((c[w >> 2] | 0) > 0) {
                        ma = m + 4 | 0;
                        Ba = m + 2436 | 0;
                        bb = m + 3034 | 0;
                        db = m + 2416 | 0;
                        Aa = m + 204 | 0;
                        sa = m + 200 | 0;
                        Ia = m + 2437 | 0;
                        Ja = m + 2420 | 0;
                        Na = m + 2424 | 0;
                        Oa = m + 5824 | 0;
                        Fa = m + 156 | 0;
                        Da = m + 2428 | 0;
                        N = m + 2438 | 0;
                        P = m + 2608 | 0;
                        ra = m + 5816 | 0;
                        U = m + 3504 | 0;
                        V = m + 5820 | 0;
                        ba = m + 3044 | 0;
                        ca = m + 3045 | 0;
                        W = m + 3046 | 0;
                        ja = m + 3040 | 0;
                        ha = m + 3036 | 0;
                        fa = m + 3032 | 0;
                        ia = m + 3033 | 0;
                        M = m + 3047 | 0;
                        eb = m + 3048 | 0;
                        la = m + 3052 | 0;
                        ka = m + 3035 | 0;
                        L = m + 3080 | 0;
                        E = m + 3101 | 0;
                        K = m + 3102 | 0;
                        ga = m + 3051 | 0;
                        La = m + 3056 | 0;
                        Y = m + 3060 | 0;
                        X = m + 3064 | 0;
                        Z = m + 3068 | 0;
                        da = m + 3049 | 0;
                        aa = m + 3072 | 0;
                        _ = m + 3076 | 0;
                        ea = m + 3050 | 0;
                        R = m + 2432 | 0;
                        Q = m + 2440 | 0;
                        T = m + 2772 | 0;
                        O = m + 2439 | 0;
                        Ma = m + 3096 | 0;
                        Ha = m + 3100 | 0;
                        Ka = m + 3488 | 0;
                        Ca = m + 5836 | 0;
                        na = m + 5848 | 0;
                        oa = m + 7668 | 0;
                        cb = o + 4 | 0;
                        ta = m + 7572 | 0;
                        va = m + 5840 | 0;
                        ua = m + 5844 | 0;
                        wa = m + 7576 | 0;
                        xa = m + 7596 | 0;
                        ya = m + 7600 | 0;
                        za = m + 7580 | 0;
                        qa = m + 160 | 0;
                        pa = m + 140 | 0;
                        Ea = m + 164 | 0;
                        J = m + 3084 | 0;
                        G = m + 3088 | 0;
                        F = m + 3092 | 0;
                        H = m + 141 | 0;
                        I = m + 7620 | 0;
                        $a = m + 3492 | 0;
                        ab = m + 3496 | 0;
                        Za = m + 7584 | 0;
                        _a = m + 7588 | 0;
                        Ya = m + 7592 | 0;
                        Wa = m + 7604 | 0;
                        Xa = m + 7568 | 0;
                        Ua = m + 1428 | 0;
                        Va = m + 1432 | 0;
                        Sa = m + 5852 | 0;
                        Ta = m + 7560 | 0;
                        Pa = m + 196 | 0;
                        Qa = m + 7616 | 0;
                        Ra = m + 168 | 0;
                        S = 0;
                        b: while (1) {
                            c[x >> 2] = c[(c[j >> 2] | 0) + (S << 2) >> 2];
                            c[z >> 2] = c[(c[y >> 2] | 0) + (S << 2) >> 2];
                            ob = c[A >> 2] | 0;
                            nb = c[ob + (S << 4) + 12 >> 2] | 0;
                            ob = c[ob + (S << 4) + 8 >> 2] | 0;
                            pb = c[u >> 2] | 0;
                            ob = ob >>> 0 > 268435455 ? -8 : ob << 3;
                            fb = ob >>> 0 > 2147483639 | (nb | 0) == 0;
                            ob = fb ? 0 : ob;
                            nb = fb ? 0 : nb;
                            c[pb + 204 >> 2] = nb;
                            c[pb + 216 >> 2] = ob;
                            c[pb + 220 >> 2] = ob + 8;
                            c[pb + 208 >> 2] = nb + (ob >> 3);
                            c[pb + 212 >> 2] = 0;
                            c: do
                                if (fb) {
                                    t = fb ? -1094995529 : 0;
                                    B = 272
                                } else {
                                    fb = cc(m) | 0;
                                    d: do
                                        if ((fb | 0) >= 0) {
                                            if (!fb) break c;
                                            switch (c[v >> 2] | 0) {
                                                case 9:
                                                case 8:
                                                case 7:
                                                case 6:
                                                case 21:
                                                case 20:
                                                case 19:
                                                case 18:
                                                case 17:
                                                case 16:
                                                case 5:
                                                case 4:
                                                case 3:
                                                case 2:
                                                case 0:
                                                case 1:
                                                    {
                                                        fb = c[u >> 2] | 0;
                                                        gb = fb + 204 | 0;
                                                        pb = (_d(gb) | 0) & 255;
                                                        a[Ba >> 0] = pb;
                                                        hb = c[v >> 2] | 0;
                                                        if (!((hb + -16 | 0) >>> 0 > 4 | pb << 24 >> 24 == 0) ? (b[Qa >> 1] = (e[Qa >> 1] | 0) + 1 & 255, c[Ca >> 2] = 2147483647, (hb + -19 | 0) >>> 0 < 2) : 0) {
                                                            rc(m);
                                                            hb = c[v >> 2] | 0
                                                        }
                                                        a[bb >> 0] = 0;
                                                        if ((hb + -16 | 0) >>> 0 < 8) a[bb >> 0] = _d(gb) | 0;
                                                        hb = ae(gb) | 0;
                                                        c[db >> 2] = hb;
                                                        if (hb >>> 0 > 255) break a;
                                                        hb = c[m + (hb << 2) + 400 >> 2] | 0;
                                                        if (!hb) break a;
                                                        if (!(a[Ba >> 0] | 0)) {
                                                            kb = c[hb + 4 >> 2] | 0;
                                                            if ((c[Aa >> 2] | 0) != (kb | 0)) break a
                                                        } else kb = c[hb + 4 >> 2] | 0;
                                                        c[Aa >> 2] = kb;
                                                        jb = c[v >> 2] | 0;
                                                        ib = (jb | 0) == 21;
                                                        if (ib ? (c[s >> 2] | 0) == 1 : 0) a[bb >> 0] = 1;
                                                        hb = c[sa >> 2] | 0;
                                                        kb = c[(c[m + (c[kb >> 2] << 2) + 272 >> 2] | 0) + 4 >> 2] | 0;
                                                        if ((hb | 0) != (kb | 0)) {
                                                            c[sa >> 2] = kb;
                                                            e: do
                                                                if (hb) {
                                                                    if ((jb + -16 | 0) >>> 0 > 7 | ib) break;
                                                                    do
                                                                        if ((c[kb + 13120 >> 2] | 0) == (c[hb + 13120 >> 2] | 0)) {
                                                                            if ((c[kb + 13124 >> 2] | 0) != (c[hb + 13124 >> 2] | 0)) break;
                                                                            if ((c[kb + 76 + (((c[kb + 72 >> 2] | 0) + -1 | 0) * 12 | 0) >> 2] | 0) == (c[hb + (((c[hb + 72 >> 2] | 0) + -1 | 0) * 12 | 0) + 76 >> 2] | 0)) break e
                                                                        }
                                                                    while (0);
                                                                    a[bb >> 0] = 0
                                                                }
                                                            while (0);
                                                            rc(m);
                                                            hb = c[sa >> 2] | 0;
                                                            bc(m);
                                                            ib = c[hb + 13064 >> 2] | 0;
                                                            jb = hb + 13120 | 0;
                                                            qb = c[jb >> 2] | 0;
                                                            kb = hb + 13124 | 0;
                                                            pb = c[kb >> 2] | 0;
                                                            ib = $((pb >> ib) + 1 | 0, (qb >> ib) + 1 | 0) | 0;
                                                            mb = $(c[hb + 13132 >> 2] | 0, c[hb + 13128 >> 2] | 0) | 0;
                                                            ob = hb + 13156 | 0;
                                                            nb = hb + 13160 | 0;
                                                            lb = $(c[nb >> 2] | 0, c[ob >> 2] | 0) | 0;
                                                            c[va >> 2] = (qb >> 2) + 1;
                                                            c[ua >> 2] = (pb >> 2) + 1;
                                                            c[$a >> 2] = oe(mb, 148) | 0;
                                                            pb = oe(mb, 8) | 0;
                                                            c[ab >> 2] = pb;
                                                            if ((c[$a >> 2] | 0) == 0 | (pb | 0) == 0) {
                                                                B = 72;
                                                                break b
                                                            }
                                                            pb = hb + 13144 | 0;
                                                            qb = hb + 13140 | 0;
                                                            c[Za >> 2] = ee($(c[qb >> 2] | 0, c[pb >> 2] | 0) | 0) | 0;
                                                            qb = ne(c[pb >> 2] | 0, c[qb >> 2] | 0) | 0;
                                                            c[_a >> 2] = qb;
                                                            if ((c[Za >> 2] | 0) == 0 | (qb | 0) == 0) {
                                                                B = 72;
                                                                break b
                                                            }
                                                            c[xa >> 2] = ne(c[hb + 13148 >> 2] | 0, c[hb + 13152 >> 2] | 0) | 0;
                                                            c[Ya >> 2] = le(lb) | 0;
                                                            nb = ee($((c[nb >> 2] | 0) + 1 | 0, (c[ob >> 2] | 0) + 1 | 0) | 0) | 0;
                                                            c[ya >> 2] = nb;
                                                            if (!(c[Ya >> 2] | 0)) {
                                                                B = 72;
                                                                break b
                                                            }
                                                            if ((c[xa >> 2] | 0) == 0 | (nb | 0) == 0) {
                                                                B = 72;
                                                                break b
                                                            }
                                                            c[Wa >> 2] = ee(mb) | 0;
                                                            c[za >> 2] = ne(ib, 4) | 0;
                                                            qb = ne(ib, 1) | 0;
                                                            c[Xa >> 2] = qb;
                                                            if (!qb) {
                                                                B = 72;
                                                                break b
                                                            }
                                                            if (!(c[Wa >> 2] | 0)) {
                                                                B = 72;
                                                                break b
                                                            }
                                                            if (!(c[za >> 2] | 0)) {
                                                                B = 72;
                                                                break b
                                                            }
                                                            c[ta >> 2] = oe(c[va >> 2] | 0, c[ua >> 2] | 0) | 0;
                                                            qb = oe(c[va >> 2] | 0, c[ua >> 2] | 0) | 0;
                                                            c[wa >> 2] = qb;
                                                            if ((c[ta >> 2] | 0) == 0 | (qb | 0) == 0) {
                                                                B = 72;
                                                                break b
                                                            }
                                                            c[Ua >> 2] = ve(lb * 12 | 0, 3) | 0;
                                                            qb = ve(mb * 392 | 0, 3) | 0;
                                                            c[Va >> 2] = qb;
                                                            if ((c[Ua >> 2] | 0) == 0 | (qb | 0) == 0) {
                                                                B = 72;
                                                                break b
                                                            }
                                                            qb = c[ma >> 2] | 0;
                                                            c[qb + 124 >> 2] = c[jb >> 2];
                                                            c[qb + 128 >> 2] = c[kb >> 2];
                                                            c[qb + 116 >> 2] = c[hb + 12 >> 2];
                                                            c[qb + 120 >> 2] = c[hb + 16 >> 2];
                                                            c[qb + 136 >> 2] = c[hb + 60 >> 2];
                                                            c[qb + 172 >> 2] = c[hb + (((c[hb + 72 >> 2] | 0) + -1 | 0) * 12 | 0) + 80 >> 2];
                                                            qb = hb + 160 | 0;
                                                            c[o + 0 >> 2] = c[qb + 0 >> 2];
                                                            c[o + 4 >> 2] = c[qb + 4 >> 2];
                                                            if (!(c[hb + 176 >> 2] | 0)) {
                                                                ib = c[ma >> 2] | 0;
                                                                c[ib + 392 >> 2] = 1
                                                            } else {
                                                                ib = c[ma >> 2] | 0;
                                                                c[ib + 392 >> 2] = (c[hb + 184 >> 2] | 0) != 0 ? 2 : 1
                                                            }
                                                            if (!(c[hb + 188 >> 2] | 0)) {
                                                                c[ib + 380 >> 2] = 2;
                                                                c[ib + 384 >> 2] = 2;
                                                                c[ib + 388 >> 2] = 2
                                                            } else {
                                                                c[ib + 380 >> 2] = d[hb + 192 >> 0];
                                                                c[ib + 384 >> 2] = d[hb + 193 >> 0];
                                                                c[ib + 388 >> 2] = d[hb + 194 >> 0]
                                                            }
                                                            qb = hb + 52 | 0;
                                                            Dc(Sa, c[qb >> 2] | 0);
                                                            de(Ta, c[qb >> 2] | 0);
                                                            if (a[hb + 12941 >> 0] | 0) {
                                                                ib = c[sa >> 2] | 0;
                                                                jb = (c[ib + 4 >> 2] | 0) != 0 ? 3 : 1;
                                                                qb = (1 << c[ib + 13080 >> 2]) + 2 | 0;
                                                                qb = $(qb, qb) | 0;
                                                                c[Ra >> 2] = ee(qb << c[ib + 56 >> 2]) | 0;
                                                                ib = 0;
                                                                do {
                                                                    qb = c[sa >> 2] | 0;
                                                                    pb = c[qb + 13124 >> 2] >> c[qb + (ib << 2) + 13180 >> 2];
                                                                    ob = $(c[qb + 13120 >> 2] >> c[qb + (ib << 2) + 13168 >> 2] << 1, c[qb + 13132 >> 2] | 0) | 0;
                                                                    c[m + (ib << 2) + 172 >> 2] = ee(ob << c[qb + 56 >> 2]) | 0;
                                                                    qb = c[sa >> 2] | 0;
                                                                    pb = $(pb << 1, c[qb + 13128 >> 2] | 0) | 0;
                                                                    c[m + (ib << 2) + 184 >> 2] = ee(pb << c[qb + 56 >> 2]) | 0;
                                                                    ib = ib + 1 | 0
                                                                } while ((ib | 0) < (jb | 0))
                                                            }
                                                            c[sa >> 2] = hb;
                                                            c[Pa >> 2] = c[(c[m + (c[hb >> 2] << 2) + 208 >> 2] | 0) + 4 >> 2];
                                                            b[Qa >> 1] = (e[Qa >> 1] | 0) + 1 & 255;
                                                            c[Ca >> 2] = 2147483647
                                                        }
                                                        qb = c[ma >> 2] | 0;
                                                        c[qb + 832 >> 2] = d[hb + 302 >> 0];
                                                        c[qb + 836 >> 2] = d[hb + 335 >> 0];
                                                        a[Ia >> 0] = 0;
                                                        do
                                                            if (!(a[Ba >> 0] | 0)) {
                                                                if (a[(c[Aa >> 2] | 0) + 41 >> 0] | 0) {
                                                                    a[Ia >> 0] = _d(gb) | 0;
                                                                    hb = c[sa >> 2] | 0
                                                                }
                                                                ib = ($(c[hb + 13128 >> 2] << 1, c[hb + 13132 >> 2] | 0) | 0) + -2 | 0;
                                                                hb = ib >>> 0 > 65535;
                                                                ib = hb ? ib >>> 16 : ib;
                                                                hb = hb ? 16 : 0;
                                                                if (ib & 65280) {
                                                                    hb = hb | 8;
                                                                    ib = ib >>> 8
                                                                }
                                                                hb = Xd(gb, (d[4872 + ib >> 0] | 0) + hb | 0) | 0;
                                                                c[Ja >> 2] = hb;
                                                                qb = c[sa >> 2] | 0;
                                                                if (hb >>> 0 >= ($(c[qb + 13132 >> 2] | 0, c[qb + 13128 >> 2] | 0) | 0) >>> 0) break a;
                                                                if (a[Ia >> 0] | 0)
                                                                    if (!(a[Fa >> 0] | 0)) break a;
                                                                    else break;
                                                                else {
                                                                    c[Na >> 2] = hb;
                                                                    c[Oa >> 2] = (c[Oa >> 2] | 0) + 1;
                                                                    B = 83;
                                                                    break
                                                                }
                                                            } else {
                                                                c[Na >> 2] = 0;
                                                                c[Ja >> 2] = 0;
                                                                c[Oa >> 2] = 0;
                                                                a[Fa >> 0] = 0;
                                                                B = 83
                                                            }
                                                        while (0);
                                                        f: do
                                                            if ((B | 0) == 83) {
                                                                B = 0;
                                                                a[Fa >> 0] = 0;
                                                                if ((c[(c[Aa >> 2] | 0) + 1624 >> 2] | 0) > 0) {
                                                                    hb = 0;
                                                                    do {
                                                                        Zd(gb, 1);
                                                                        hb = hb + 1 | 0
                                                                    } while ((hb | 0) < (c[(c[Aa >> 2] | 0) + 1624 >> 2] | 0))
                                                                }
                                                                hb = ae(gb) | 0;
                                                                c[Da >> 2] = hb;
                                                                if (hb >>> 0 >= 3) break a;
                                                                if (!((hb | 0) == 2 ? 1 : ((c[v >> 2] | 0) + -16 | 0) >>> 0 > 7)) break a;
                                                                a[N >> 0] = 1;
                                                                if (a[(c[Aa >> 2] | 0) + 39 >> 0] | 0) a[N >> 0] = _d(gb) | 0;
                                                                if (a[(c[sa >> 2] | 0) + 8 >> 0] | 0) a[O >> 0] = Xd(gb, 2) | 0;
                                                                do
                                                                    if (((c[v >> 2] | 0) + -19 | 0) >>> 0 >= 2) {
                                                                        hb = Xd(gb, c[(c[sa >> 2] | 0) + 64 >> 2] | 0) | 0;
                                                                        c[R >> 2] = hb;
                                                                        hb = Ac(m, hb) | 0;
                                                                        do
                                                                            if (!(a[Ba >> 0] | 0)) {
                                                                                ib = c[ra >> 2] | 0;
                                                                                if ((hb | 0) == (ib | 0)) break;
                                                                                if (!(c[(c[ma >> 2] | 0) + 688 >> 2] & 8)) hb = ib;
                                                                                else break a
                                                                            }
                                                                        while (0);
                                                                        c[ra >> 2] = hb;
                                                                        qb = (_d(gb) | 0) == 0;
                                                                        ib = c[sa >> 2] | 0;
                                                                        if (qb) {
                                                                            if ((yd(m, Q, ib, 1) | 0) < 0) break a;
                                                                            c[P >> 2] = Q;
                                                                            ib = c[sa >> 2] | 0
                                                                        } else {
                                                                            hb = c[ib + 2184 >> 2] | 0;
                                                                            if (!hb) break a;
                                                                            hb = (hb << 1) + -2 | 0;
                                                                            jb = hb >>> 0 > 65535;
                                                                            hb = jb ? hb >>> 16 : hb;
                                                                            jb = jb ? 16 : 0;
                                                                            if (hb & 65280) {
                                                                                jb = jb | 8;
                                                                                hb = hb >>> 8
                                                                            }
                                                                            hb = (d[4872 + hb >> 0] | 0) + jb | 0;
                                                                            if ((hb | 0) > 0) {
                                                                                hb = Xd(gb, hb) | 0;
                                                                                ib = c[sa >> 2] | 0
                                                                            } else hb = 0;
                                                                            c[P >> 2] = ib + (hb * 168 | 0) + 2188
                                                                        }
                                                                        hb = ib + 64 | 0;
                                                                        jb = c[hb >> 2] | 0;
                                                                        a[T >> 0] = 0;
                                                                        do
                                                                            if (a[ib + 12942 >> 0] | 0) {
                                                                                kb = ib + 13040 | 0;
                                                                                if (!(a[kb >> 0] | 0)) lb = 0;
                                                                                else lb = ae(gb) | 0;
                                                                                mb = ae(gb) | 0;
                                                                                qb = gf(mb | 0, 0, lb | 0, 0) | 0;
                                                                                pb = D;
                                                                                if (pb >>> 0 > 0 | (pb | 0) == 0 & qb >>> 0 > 32)
                                                                                    if (!(c[(c[ma >> 2] | 0) + 688 >> 2] & 8)) break;
                                                                                    else break a;
                                                                                qb = mb + lb | 0;
                                                                                a[T >> 0] = qb;
                                                                                if (!(qb & 255)) break;
                                                                                else {
                                                                                    mb = 0;
                                                                                    nb = 0
                                                                                }
                                                                                do {
                                                                                    if (mb >>> 0 < lb >>> 0) {
                                                                                        ob = a[kb >> 0] | 0;
                                                                                        if ((ob & 255) > 1) {
                                                                                            ob = ((ob & 255) << 1) + -2 | 0;
                                                                                            pb = ob >>> 0 > 65535;
                                                                                            ob = pb ? ob >>> 16 : ob;
                                                                                            pb = pb ? 16 : 0;
                                                                                            if (ob & 65280) {
                                                                                                pb = pb | 8;
                                                                                                ob = ob >>> 8
                                                                                            }
                                                                                            ob = (Xd(gb, (d[4872 + ob >> 0] | 0) + pb | 0) | 0) & 255
                                                                                        } else ob = 0;
                                                                                        c[m + (mb << 2) + 2612 >> 2] = e[ib + (ob << 1) + 12944 >> 1];
                                                                                        a[m + mb + 2740 >> 0] = a[ib + ob + 13008 >> 0] | 0
                                                                                    } else {
                                                                                        c[m + (mb << 2) + 2612 >> 2] = Xd(gb, c[hb >> 2] | 0) | 0;
                                                                                        a[m + mb + 2740 >> 0] = _d(gb) | 0
                                                                                    }
                                                                                    if (((_d(gb) | 0) & 255) << 24 >> 24) {
                                                                                        qb = ae(gb) | 0;
                                                                                        nb = qb + ((mb | 0) == 0 | (mb | 0) == (lb | 0) ? 0 : nb) | 0;
                                                                                        qb = m + (mb << 2) + 2612 | 0;
                                                                                        c[qb >> 2] = (c[ra >> 2] | 0) - (nb << jb) - (c[R >> 2] | 0) + (c[qb >> 2] | 0)
                                                                                    }
                                                                                    mb = mb + 1 | 0
                                                                                } while ((mb | 0) < (d[T >> 0] | 0))
                                                                            }
                                                                        while (0);
                                                                        if (!(a[(c[sa >> 2] | 0) + 13060 >> 0] | 0)) {
                                                                            a[ka >> 0] = 0;
                                                                            break
                                                                        } else {
                                                                            a[ka >> 0] = _d(gb) | 0;
                                                                            break
                                                                        }
                                                                    } else {
                                                                        c[P >> 2] = 0;
                                                                        c[ra >> 2] = 0
                                                                    }
                                                                while (0);
                                                                g: do
                                                                    if (!(c[U >> 2] | 0)) {
                                                                        switch (c[v >> 2] | 0) {
                                                                            case 9:
                                                                            case 8:
                                                                            case 7:
                                                                            case 6:
                                                                            case 4:
                                                                            case 2:
                                                                            case 0:
                                                                                break g;
                                                                            default:
                                                                                {}
                                                                        }
                                                                        c[V >> 2] = c[ra >> 2]
                                                                    }
                                                                while (0);
                                                                do
                                                                    if (a[(c[sa >> 2] | 0) + 12941 >> 0] | 0) {
                                                                        a[ba >> 0] = _d(gb) | 0;
                                                                        if (!(c[(c[sa >> 2] | 0) + 4 >> 2] | 0)) {
                                                                            a[ca >> 0] = 0;
                                                                            a[W >> 0] = 0;
                                                                            break
                                                                        } else {
                                                                            qb = (_d(gb) | 0) & 255;
                                                                            a[W >> 0] = qb;
                                                                            a[ca >> 0] = qb;
                                                                            break
                                                                        }
                                                                    } else {
                                                                        a[ba >> 0] = 0;
                                                                        a[ca >> 0] = 0;
                                                                        a[W >> 0] = 0
                                                                    }
                                                                while (0);
                                                                c[ja >> 2] = 0;
                                                                c[ha >> 2] = 0;
                                                                ib = c[Da >> 2] | 0;
                                                                if (ib >>> 0 < 2) {
                                                                    hb = c[Aa >> 2] | 0;
                                                                    c[ha >> 2] = c[hb + 8 >> 2];
                                                                    if (!ib) c[ja >> 2] = c[hb + 12 >> 2];
                                                                    do
                                                                        if (!(_d(gb) | 0)) B = 138;
                                                                        else {
                                                                            hb = (ae(gb) | 0) + 1 | 0;
                                                                            c[ha >> 2] = hb;
                                                                            if (c[Da >> 2] | 0) break;
                                                                            c[ja >> 2] = (ae(gb) | 0) + 1;
                                                                            B = 138
                                                                        }
                                                                    while (0);
                                                                    if ((B | 0) == 138) {
                                                                        B = 0;
                                                                        hb = c[ha >> 2] | 0
                                                                    }
                                                                    if (hb >>> 0 > 16) break a;
                                                                    if ((c[ja >> 2] | 0) >>> 0 > 16) break a;
                                                                    a[fa >> 0] = 0;
                                                                    a[ia >> 0] = 0;
                                                                    jb = Bc(m) | 0;
                                                                    if (!jb) break a;
                                                                    do
                                                                        if ((jb | 0) > 1 ? (a[(c[Aa >> 2] | 0) + 1617 >> 0] | 0) != 0 : 0) {
                                                                            qb = (_d(gb) | 0) & 255;
                                                                            a[fa >> 0] = qb;
                                                                            do
                                                                                if (qb << 24 >> 24) {
                                                                                    if (!(c[ha >> 2] | 0)) break;
                                                                                    qb = (jb << 1) + -2 | 0;
                                                                                    hb = qb >>> 0 > 65535;
                                                                                    qb = hb ? qb >>> 16 : qb;
                                                                                    hb = hb ? 16 : 0;
                                                                                    ib = (qb & 65280 | 0) == 0;
                                                                                    hb = (d[4872 + (ib ? qb : qb >>> 8) >> 0] | 0) + (ib ? hb : hb | 8) | 0;
                                                                                    ib = 0;
                                                                                    do {
                                                                                        c[m + (ib << 2) + 2776 >> 2] = Xd(gb, hb) | 0;
                                                                                        ib = ib + 1 | 0
                                                                                    } while (ib >>> 0 < (c[ha >> 2] | 0) >>> 0)
                                                                                }
                                                                            while (0);
                                                                            if (c[Da >> 2] | 0) break;
                                                                            qb = _d(gb) | 0;
                                                                            a[ia >> 0] = qb;
                                                                            if ((qb & 255 | 0) != 1) {
                                                                                B = 152;
                                                                                break
                                                                            }
                                                                            if (!(c[ja >> 2] | 0)) {
                                                                                B = 152;
                                                                                break
                                                                            }
                                                                            qb = (jb << 1) + -2 | 0;
                                                                            hb = qb >>> 0 > 65535;
                                                                            qb = hb ? qb >>> 16 : qb;
                                                                            hb = hb ? 16 : 0;
                                                                            B = (qb & 65280 | 0) == 0;
                                                                            hb = (d[4872 + (B ? qb : qb >>> 8) >> 0] | 0) + (B ? hb : hb | 8) | 0;
                                                                            B = 0;
                                                                            do {
                                                                                c[m + (B << 2) + 2904 >> 2] = Xd(gb, hb) | 0;
                                                                                B = B + 1 | 0
                                                                            } while (B >>> 0 < (c[ja >> 2] | 0) >>> 0);
                                                                            B = 152
                                                                        } else B = 152;
                                                                    while (0);
                                                                    do
                                                                        if ((B | 0) == 152) {
                                                                            if (c[Da >> 2] | 0) break;
                                                                            a[M >> 0] = _d(gb) | 0
                                                                        }
                                                                    while (0);
                                                                    if (!(a[(c[Aa >> 2] | 0) + 5 >> 0] | 0)) B = 0;
                                                                    else B = (_d(gb) | 0) & 255;
                                                                    a[eb >> 0] = B;
                                                                    c[la >> 2] = 0;
                                                                    do
                                                                        if (a[ka >> 0] | 0) {
                                                                            a[ga >> 0] = 0;
                                                                            if (!(c[Da >> 2] | 0)) {
                                                                                B = (_d(gb) | 0) == 0 & 1;
                                                                                a[ga >> 0] = B
                                                                            } else B = 0;
                                                                            if ((c[m + ((B & 255) << 2) + 3036 >> 2] | 0) >>> 0 <= 1) break;
                                                                            qb = ae(gb) | 0;
                                                                            c[la >> 2] = qb;
                                                                            if (qb >>> 0 >= (c[m + (d[ga >> 0] << 2) + 3036 >> 2] | 0) >>> 0) break a
                                                                        }
                                                                    while (0);
                                                                    hb = c[Aa >> 2] | 0;
                                                                    if ((a[hb + 37 >> 0] | 0) != 0 ? (c[Da >> 2] | 0) == 1 : 0) B = 165;
                                                                    else B = 163;
                                                                    do
                                                                        if ((B | 0) == 163) {
                                                                            B = 0;
                                                                            if (!(a[hb + 38 >> 0] | 0)) break;
                                                                            if (!(c[Da >> 2] | 0)) B = 165
                                                                        }
                                                                    while (0);
                                                                    do
                                                                        if ((B | 0) == 165) {
                                                                            B = 0;
                                                                            a[E >> 0] = ae(gb) | 0;
                                                                            if (c[(c[sa >> 2] | 0) + 4 >> 2] | 0) {
                                                                                hb = be(gb) | 0;
                                                                                hb = (d[E >> 0] | 0) + hb | 0;
                                                                                if ((hb | 0) < 0) hb = 0;
                                                                                else hb = (hb | 0) > 7 ? 7 : hb & 65535;
                                                                                b[K >> 1] = hb
                                                                            }
                                                                            if (!(c[ha >> 2] | 0)) hb = 0;
                                                                            else {
                                                                                ib = 0;
                                                                                do {
                                                                                    qb = (_d(gb) | 0) & 255;
                                                                                    a[n + ib >> 0] = qb;
                                                                                    if (!(qb << 24 >> 24)) {
                                                                                        b[m + (ib << 1) + 3104 >> 1] = 1 << d[E >> 0];
                                                                                        b[m + (ib << 1) + 3296 >> 1] = 0
                                                                                    }
                                                                                    ib = ib + 1 | 0;
                                                                                    hb = c[ha >> 2] | 0
                                                                                } while (ib >>> 0 < hb >>> 0)
                                                                            }
                                                                            ib = (hb | 0) == 0;
                                                                            if (!(c[(c[sa >> 2] | 0) + 4 >> 2] | 0)) {
                                                                                if (ib) break;
                                                                                jf(r | 0, 0, (hb >>> 0 > 1 ? hb : 1) | 0) | 0
                                                                            } else {
                                                                                if (ib) break;
                                                                                else hb = 0;
                                                                                do {
                                                                                    a[r + hb >> 0] = _d(gb) | 0;
                                                                                    hb = hb + 1 | 0;
                                                                                    ib = c[ha >> 2] | 0
                                                                                } while (hb >>> 0 < ib >>> 0);
                                                                                hb = ib
                                                                            }
                                                                            if (!hb) break;
                                                                            else ib = 0;
                                                                            do {
                                                                                if (a[n + ib >> 0] | 0) {
                                                                                    qb = be(gb) | 0;
                                                                                    b[m + (ib << 1) + 3104 >> 1] = (1 << d[E >> 0]) + qb;
                                                                                    b[m + (ib << 1) + 3296 >> 1] = be(gb) | 0
                                                                                }
                                                                                if (!(a[r + ib >> 0] | 0)) {
                                                                                    qb = 1 << b[K >> 1] & 65535;
                                                                                    b[m + (ib << 2) + 3136 >> 1] = qb;
                                                                                    b[m + (ib << 2) + 3328 >> 1] = 0;
                                                                                    b[m + (ib << 2) + 3138 >> 1] = qb;
                                                                                    b[m + (ib << 2) + 3330 >> 1] = 0
                                                                                } else {
                                                                                    hb = 0;
                                                                                    do {
                                                                                        jb = be(gb) | 0;
                                                                                        qb = be(gb) | 0;
                                                                                        jb = (1 << b[K >> 1]) + jb | 0;
                                                                                        b[m + (ib << 2) + (hb << 1) + 3136 >> 1] = jb;
                                                                                        jb = qb - (jb << 16 >> 9 >> b[K >> 1]) + 128 | 0;
                                                                                        if ((jb | 0) < -128) jb = -128;
                                                                                        else jb = (jb | 0) > 127 ? 127 : jb & 65535;
                                                                                        b[m + (ib << 2) + (hb << 1) + 3328 >> 1] = jb;
                                                                                        hb = hb + 1 | 0
                                                                                    } while ((hb | 0) != 2)
                                                                                }
                                                                                ib = ib + 1 | 0
                                                                            } while (ib >>> 0 < (c[ha >> 2] | 0) >>> 0)
                                                                        }
                                                                    while (0);
                                                                    pb = ae(gb) | 0;
                                                                    qb = 5 - pb | 0;
                                                                    c[L >> 2] = qb;
                                                                    if ((pb | 0) == 5 | qb >>> 0 > 5) break a
                                                                }
                                                                c[La >> 2] = be(gb) | 0;
                                                                hb = c[Aa >> 2] | 0;
                                                                if (!(a[hb + 36 >> 0] | 0)) {
                                                                    c[Y >> 2] = 0;
                                                                    c[X >> 2] = 0
                                                                } else {
                                                                    c[Y >> 2] = be(gb) | 0;
                                                                    c[X >> 2] = be(gb) | 0;
                                                                    hb = c[Aa >> 2] | 0
                                                                }
                                                                if (!(a[hb + 1631 >> 0] | 0)) a[Z >> 0] = 0;
                                                                else {
                                                                    a[Z >> 0] = _d(gb) | 0;
                                                                    hb = c[Aa >> 2] | 0
                                                                }
                                                                h: do
                                                                    if (!(a[hb + 55 >> 0] | 0)) {
                                                                        a[da >> 0] = 0;
                                                                        c[aa >> 2] = 0;
                                                                        c[_ >> 2] = 0
                                                                    } else {
                                                                        do
                                                                            if (a[hb + 56 >> 0] | 0) {
                                                                                if (!(_d(gb) | 0)) {
                                                                                    hb = c[Aa >> 2] | 0;
                                                                                    break
                                                                                }
                                                                                qb = (_d(gb) | 0) & 255;
                                                                                a[da >> 0] = qb;
                                                                                if (qb << 24 >> 24) break h;
                                                                                c[aa >> 2] = (be(gb) | 0) << 1;
                                                                                c[_ >> 2] = (be(gb) | 0) << 1;
                                                                                break h
                                                                            }
                                                                        while (0);
                                                                        a[da >> 0] = a[hb + 57 >> 0] | 0;
                                                                        c[aa >> 2] = c[hb + 60 >> 2];
                                                                        c[_ >> 2] = c[hb + 64 >> 2]
                                                                    }
                                                                while (0);
                                                                hb = a[(c[Aa >> 2] | 0) + 54 >> 0] | 0;
                                                                i: do
                                                                    if (hb << 24 >> 24) {
                                                                        do
                                                                            if (!(a[ba >> 0] | 0)) {
                                                                                if (a[ca >> 0] | 0) break;
                                                                                if (a[da >> 0] | 0) break i
                                                                            }
                                                                        while (0);
                                                                        a[ea >> 0] = _d(gb) | 0;
                                                                        break f
                                                                    }
                                                                while (0);
                                                                a[ea >> 0] = hb
                                                            }
                                                        while (0);
                                                        c[Ma >> 2] = 0;
                                                        qb = c[Aa >> 2] | 0;
                                                        if (!((a[qb + 42 >> 0] | 0) == 0 ? (a[qb + 43 >> 0] | 0) == 0 : 0)) B = 211;
                                                        j: do
                                                            if ((B | 0) == 211) {
                                                                B = 0;
                                                                qb = ae(gb) | 0;
                                                                c[Ma >> 2] = qb;
                                                                if ((qb | 0) <= 0) {
                                                                    c[I >> 2] = 0;
                                                                    break
                                                                }
                                                                hb = (ae(gb) | 0) + 1 | 0;
                                                                ib = hb >> 4;
                                                                hb = hb & 15;
                                                                ie(J);
                                                                ie(G);
                                                                ie(F);
                                                                c[J >> 2] = ne(c[Ma >> 2] | 0, 4) | 0;
                                                                c[G >> 2] = ne(c[Ma >> 2] | 0, 4) | 0;
                                                                jb = ne(c[Ma >> 2] | 0, 4) | 0;
                                                                c[F >> 2] = jb;
                                                                if (!(c[J >> 2] | 0)) {
                                                                    B = 216;
                                                                    break b
                                                                }
                                                                if ((c[G >> 2] | 0) == 0 | (jb | 0) == 0) {
                                                                    B = 216;
                                                                    break b
                                                                }
                                                                if ((c[Ma >> 2] | 0) > 0) {
                                                                    lb = (ib | 0) > 0;
                                                                    kb = (hb | 0) == 0;
                                                                    jb = 0;
                                                                    do {
                                                                        if (lb) {
                                                                            mb = 0;
                                                                            nb = 0;
                                                                            do {
                                                                                nb = (Xd(gb, 16) | 0) + (nb << 16) | 0;
                                                                                mb = mb + 1 | 0
                                                                            } while ((mb | 0) != (ib | 0))
                                                                        } else nb = 0;
                                                                        if (!kb) nb = (Xd(gb, hb) | 0) + (nb << hb) | 0;
                                                                        c[(c[J >> 2] | 0) + (jb << 2) >> 2] = nb + 1;
                                                                        jb = jb + 1 | 0
                                                                    } while ((jb | 0) < (c[Ma >> 2] | 0))
                                                                }
                                                                do
                                                                    if ((d[H >> 0] | 0) > 1) {
                                                                        qb = c[Aa >> 2] | 0;
                                                                        if ((c[qb + 48 >> 2] | 0) <= 1 ? (c[qb + 44 >> 2] | 0) <= 1 : 0) break;
                                                                        c[I >> 2] = 0;
                                                                        a[H >> 0] = 1;
                                                                        break j
                                                                    }
                                                                while (0);
                                                                c[I >> 2] = 0
                                                            }
                                                        while (0);
                                                        hb = c[Aa >> 2] | 0;
                                                        if (a[hb + 1628 >> 0] | 0) {
                                                            hb = ae(gb) | 0;
                                                            pb = kf(hb | 0, 0, 3) | 0;
                                                            nb = D;
                                                            qb = (c[fb + 216 >> 2] | 0) - (c[fb + 212 >> 2] | 0) | 0;
                                                            ob = ((qb | 0) < 0) << 31 >> 31;
                                                            if ((nb | 0) > (ob | 0) | (nb | 0) == (ob | 0) & pb >>> 0 > qb >>> 0) break a;
                                                            if (hb) {
                                                                ib = 0;
                                                                do {
                                                                    Zd(gb, 8);
                                                                    ib = ib + 1 | 0
                                                                } while ((ib | 0) != (hb | 0))
                                                            }
                                                            hb = c[Aa >> 2] | 0
                                                        }
                                                        gb = (c[hb + 16 >> 2] | 0) + 26 + (c[La >> 2] | 0) | 0;
                                                        a[Ha >> 0] = gb;
                                                        gb = gb << 24;
                                                        if ((gb | 0) > 855638016) break a;
                                                        if ((gb >> 24 | 0) < (0 - (c[(c[sa >> 2] | 0) + 13192 >> 2] | 0) | 0)) break a;
                                                        qb = c[Ja >> 2] | 0;
                                                        c[Ka >> 2] = qb;
                                                        if ((qb | 0) == 0 ? (a[Ia >> 0] | 0) != 0 : 0) break a;
                                                        if (((c[fb + 216 >> 2] | 0) - (c[fb + 212 >> 2] | 0) | 0) < 0) break a;
                                                        a[(c[u >> 2] | 0) + 203 >> 0] = (a[Ia >> 0] | 0) == 0 & 1;
                                                        if (!(a[(c[Aa >> 2] | 0) + 22 >> 0] | 0)) a[(c[u >> 2] | 0) + 272 >> 0] = a[Ha >> 0] | 0;
                                                        a[Fa >> 0] = 1;
                                                        a[(c[u >> 2] | 0) + 302 >> 0] = 0;
                                                        a[(c[u >> 2] | 0) + 303 >> 0] = 0;
                                                        gb = c[Ca >> 2] | 0;
                                                        fb = c[v >> 2] | 0;
                                                        k: do
                                                            if ((gb | 0) == 2147483647) switch (fb | 0) {
                                                                case 18:
                                                                case 16:
                                                                case 17:
                                                                case 21:
                                                                    {
                                                                        gb = c[ra >> 2] | 0;
                                                                        c[Ca >> 2] = gb;
                                                                        break k
                                                                    };
                                                                case 20:
                                                                case 19:
                                                                    {
                                                                        c[Ca >> 2] = -2147483648;
                                                                        gb = -2147483648;
                                                                        break k
                                                                    };
                                                                default:
                                                                    {
                                                                        gb = 2147483647;
                                                                        break k
                                                                    }
                                                            }
                                                            while (0);
                                                        do
                                                            if ((fb + -8 | 0) >>> 0 < 2) {
                                                                if ((c[ra >> 2] | 0) <= (gb | 0)) {
                                                                    c[na >> 2] = 0;
                                                                    break c
                                                                }
                                                                if ((fb | 0) != 9) break;
                                                                c[Ca >> 2] = -2147483648
                                                            }
                                                        while (0);
                                                        l: do
                                                            if (!(a[Ba >> 0] | 0)) {
                                                                if (!(c[q >> 2] | 0)) {
                                                                    fb = 0;
                                                                    break d
                                                                }
                                                            } else {
                                                                fb = c[u >> 2] | 0;
                                                                pb = c[sa >> 2] | 0;
                                                                gb = c[pb + 13064 >> 2] | 0;
                                                                qb = c[pb + 13120 >> 2] >> gb;
                                                                gb = (c[pb + 13124 >> 2] >> gb) + 1 | 0;
                                                                jf(c[ta >> 2] | 0, 0, $(c[ua >> 2] | 0, c[va >> 2] | 0) | 0) | 0;
                                                                jf(c[wa >> 2] | 0, 0, $(c[ua >> 2] | 0, c[va >> 2] | 0) | 0) | 0;
                                                                pb = c[sa >> 2] | 0;
                                                                jf(c[xa >> 2] | 0, 0, $(c[pb + 13152 >> 2] | 0, c[pb + 13148 >> 2] | 0) | 0) | 0;
                                                                pb = c[sa >> 2] | 0;
                                                                jf(c[ya >> 2] | 0, 0, $((c[pb + 13160 >> 2] | 0) + 1 | 0, (c[pb + 13156 >> 2] | 0) + 1 | 0) | 0) | 0;
                                                                jf(c[za >> 2] | 0, -1, $((qb << 2) + 4 | 0, gb) | 0) | 0;
                                                                c[na >> 2] = 0;
                                                                c[oa >> 2] = c[v >> 2];
                                                                gb = c[Aa >> 2] | 0;
                                                                if (a[gb + 42 >> 0] | 0) c[fb + 312 >> 2] = c[c[gb + 1648 >> 2] >> 2] << c[(c[sa >> 2] | 0) + 13080 >> 2];
                                                                fb = tc(m, qa, c[ra >> 2] | 0) | 0;
                                                                do
                                                                    if ((fb | 0) < 0) t = fb;
                                                                    else {
                                                                        fb = yc(m) | 0;
                                                                        if ((fb | 0) < 0) {
                                                                            t = fb;
                                                                            break
                                                                        }
                                                                        qb = ((c[v >> 2] | 0) + -16 | 0) >>> 0 < 8;
                                                                        c[(c[c[q >> 2] >> 2] | 0) + 80 >> 2] = qb & 1;
                                                                        c[(c[qa >> 2] | 0) + 84 >> 2] = 3 - (c[Da >> 2] | 0);
                                                                        if (!qb) wc(m);
                                                                        De(c[Ea >> 2] | 0);
                                                                        fb = vc(m, c[Ea >> 2] | 0, 0) | 0;
                                                                        if ((fb | 0) < 0) {
                                                                            t = fb;
                                                                            break
                                                                        }
                                                                        fb = c[v >> 2] | 0;
                                                                        break l
                                                                    }
                                                                while (0);
                                                                do
                                                                    if ((c[q >> 2] | 0) != 0 ? (a[pa >> 0] | 0) != 1 : 0) break;
                                                                while (0);
                                                                c[q >> 2] = 0;
                                                                B = 272;
                                                                break c
                                                            }
                                                        while (0);
                                                        if ((fb | 0) != (c[oa >> 2] | 0)) break a;
                                                        do
                                                            if (!(a[Ia >> 0] | 0)) {
                                                                if ((c[Da >> 2] | 0) == 2) break;
                                                                fb = xc(m) | 0;
                                                                if ((fb | 0) < 0) break d
                                                            }
                                                        while (0);
                                                        c[o >> 2] = 0;
                                                        c[cb >> 2] = 1;
                                                        fb = c[ma >> 2] | 0;
                                                        Ga[c[fb + 816 >> 2] & 1](fb, 1, o, p, 1, 4) | 0;
                                                        fb = c[p >> 2] | 0;
                                                        qb = c[sa >> 2] | 0;
                                                        if ((fb | 0) >= ($(c[qb + 13132 >> 2] | 0, c[qb + 13128 >> 2] | 0) | 0)) c[na >> 2] = 1;
                                                        if ((fb | 0) < 0) break d;
                                                        else break c
                                                    };
                                                case 48:
                                                    {
                                                        fb = zd(m) | 0;
                                                        if ((fb | 0) < 0) break d;
                                                        else break c
                                                    };
                                                case 34:
                                                    {
                                                        fb = Ad(m) | 0;
                                                        if ((fb | 0) < 0) break d;
                                                        else break c
                                                    };
                                                case 40:
                                                case 39:
                                                    {
                                                        fb = Cd(m) | 0;
                                                        if ((fb | 0) < 0) break d;
                                                        else break c
                                                    };
                                                case 37:
                                                case 36:
                                                    {
                                                        b[Qa >> 1] = (e[Qa >> 1] | 0) + 1 & 255;
                                                        c[Ca >> 2] = 2147483647;
                                                        break c
                                                    };
                                                default:
                                                    break c
                                            }
                                        }
                                    while (0);
                                    t = (c[(c[ma >> 2] | 0) + 688 >> 2] & 8 | 0) == 0 ? 0 : fb;
                                    B = 272
                                }
                            while (0);
                            if ((B | 0) == 272 ? (B = 0, (t | 0) < 0) : 0) break a;
                            S = S + 1 | 0;
                            if ((S | 0) >= (c[w >> 2] | 0)) break a
                        }
                        if ((B | 0) == 72) {
                            bc(m);
                            bc(m);
                            c[sa >> 2] = 0;
                            break
                        } else if ((B | 0) == 216) {
                            c[Ma >> 2] = 0;
                            break
                        }
                    }
                } else C = 0;
            while (0);
            if ((C | 0) < 0) {
                qb = C;
                i = k;
                return qb | 0
            }
            n = m + 5848 | 0;
            if (c[n >> 2] | 0) c[n >> 2] = 0;
            m = c[m + 164 >> 2] | 0;
            if (c[m + 304 >> 2] | 0) {
                qb = m + 128 | 0;
                c[qb >> 2] = e[l >> 1];
                c[qb + 4 >> 2] = 0;
                Ee(g, m);
                c[h >> 2] = 1
            }
            qb = c[f >> 2] | 0;
            i = k;
            return qb | 0
        }

        function $b(b) {
            b = b | 0;
            var d = 0,
                e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0;
            d = i;
            e = c[b + 60 >> 2] | 0;
            bc(e);
            b = e + 7664 | 0;
            f = e + 7644 | 0;
            if ((c[b >> 2] | 0) > 0) {
                g = 0;
                do {
                    ie((c[f >> 2] | 0) + (g << 2) | 0);
                    g = g + 1 | 0
                } while ((g | 0) < (c[b >> 2] | 0))
            }
            ie(e + 7648 | 0);
            ie(e + 7640 | 0);
            ie(f);
            ie(e + 152 | 0);
            ie(e + 168 | 0);
            ie(e + 172 | 0);
            ie(e + 184 | 0);
            ie(e + 176 | 0);
            ie(e + 188 | 0);
            ie(e + 180 | 0);
            ie(e + 192 | 0);
            Ce(e + 164 | 0);
            g = e + 3512 | 0;
            f = 0;
            do {
                l = g + (f * 72 | 0) | 0;
                pc(e, l, -1);
                Ce(l);
                f = f + 1 | 0
            } while ((f | 0) != 32);
            g = e + 208 | 0;
            f = 0;
            do {
                ue(g + (f << 2) | 0);
                f = f + 1 | 0
            } while ((f | 0) != 16);
            g = e + 272 | 0;
            f = 0;
            do {
                ue(g + (f << 2) | 0);
                f = f + 1 | 0
            } while ((f | 0) != 32);
            g = e + 400 | 0;
            f = 0;
            do {
                ue(g + (f << 2) | 0);
                f = f + 1 | 0
            } while ((f | 0) != 256);
            c[e + 200 >> 2] = 0;
            c[e + 204 >> 2] = 0;
            c[e + 196 >> 2] = 0;
            ue(e + 1424 | 0);
            ie(e + 3084 | 0);
            ie(e + 3088 | 0);
            ie(e + 3092 | 0);
            h = e + 141 | 0;
            l = a[h >> 0] | 0;
            f = e + 72 | 0;
            if ((l & 255) > 1) {
                g = e + 8 | 0;
                j = 1;
                do {
                    k = f + (j << 2) | 0;
                    if (c[k >> 2] | 0) {
                        ie(k);
                        ie(g + (j << 2) | 0);
                        l = a[h >> 0] | 0
                    }
                    j = j + 1 | 0
                } while ((j | 0) < (l & 255 | 0))
            }
            g = e + 136 | 0;
            if ((c[g >> 2] | 0) == (c[f >> 2] | 0)) c[g >> 2] = 0;
            ie(f);
            f = e + 7656 | 0;
            if ((c[b >> 2] | 0) <= 0) {
                ie(f);
                c[b >> 2] = 0;
                i = d;
                return 0
            }
            e = 0;
            do {
                ie((c[f >> 2] | 0) + (e << 4) | 0);
                e = e + 1 | 0
            } while ((e | 0) < (c[b >> 2] | 0));
            ie(f);
            c[b >> 2] = 0;
            i = d;
            return 0
        }

        function ac(a) {
            a = a | 0;
            var b = 0;
            b = i;
            a = c[a + 60 >> 2] | 0;
            sc(a);
            c[a + 5836 >> 2] = 2147483647;
            i = b;
            return
        }

        function bc(a) {
            a = a | 0;
            var b = 0;
            b = i;
            ie(a + 3492 | 0);
            ie(a + 3496 | 0);
            ie(a + 7584 | 0);
            ie(a + 7588 | 0);
            ie(a + 7592 | 0);
            ie(a + 7596 | 0);
            ie(a + 7600 | 0);
            ie(a + 7568 | 0);
            ie(a + 7580 | 0);
            ie(a + 7604 | 0);
            ie(a + 7572 | 0);
            ie(a + 7576 | 0);
            ie(a + 3084 | 0);
            ie(a + 3092 | 0);
            ie(a + 3088 | 0);
            we(a + 1428 | 0);
            we(a + 1432 | 0);
            i = b;
            return
        }

        function cc(a) {
            a = a | 0;
            var b = 0,
                d = 0,
                e = 0;
            b = i;
            d = (c[a + 136 >> 2] | 0) + 204 | 0;
            if (_d(d) | 0) {
                e = -1094995529;
                i = b;
                return e | 0
            }
            c[a + 3500 >> 2] = Xd(d, 6) | 0;
            e = Xd(d, 6) | 0;
            d = (Xd(d, 3) | 0) + -1 | 0;
            c[a + 3504 >> 2] = d;
            if ((d | 0) < 0) {
                e = -1094995529;
                i = b;
                return e | 0
            }
            e = (e | 0) == 0 & 1;
            i = b;
            return e | 0
        }

        function dc(e, f) {
            e = e | 0;
            f = f | 0;
            var g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                D = 0,
                E = 0,
                F = 0,
                G = 0,
                H = 0,
                I = 0,
                J = 0,
                K = 0,
                L = 0,
                M = 0,
                N = 0,
                O = 0,
                P = 0,
                Q = 0,
                R = 0,
                S = 0,
                T = 0,
                U = 0,
                V = 0,
                W = 0;
            f = i;
            h = c[e + 60 >> 2] | 0;
            k = h + 200 | 0;
            E = c[k >> 2] | 0;
            e = 1 << c[E + 13080 >> 2];
            l = h + 204 | 0;
            n = c[l >> 2] | 0;
            A = c[(c[n + 1668 >> 2] | 0) + (c[h + 3488 >> 2] << 2) >> 2] | 0;
            m = (a[h + 2437 >> 0] | 0) == 0;
            if (!A)
                if (m) g = 4;
                else {
                    W = -1094995529;
                    i = f;
                    return W | 0
                } else if (!m) {
                m = h + 7580 | 0;
                r = h + 2424 | 0;
                if ((c[(c[m >> 2] | 0) + (c[(c[n + 1672 >> 2] | 0) + (A + -1 << 2) >> 2] << 2) >> 2] | 0) != (c[r >> 2] | 0)) {
                    W = -1094995529;
                    i = f;
                    return W | 0
                }
            } else g = 4;
            if ((g | 0) == 4) {
                m = h + 7580 | 0;
                r = h + 2424 | 0
            }
            q = e + -1 | 0;
            s = h + 136 | 0;
            p = h + 3492 | 0;
            y = h + 3044 | 0;
            o = h + 3045 | 0;
            w = h + 3072 | 0;
            x = h + 3496 | 0;
            v = h + 3076 | 0;
            u = h + 3050 | 0;
            t = h + 7604 | 0;
            z = 0;
            n = 0;
            do {
                if ((A | 0) >= (c[E + 13136 >> 2] | 0)) break;
                G = c[l >> 2] | 0;
                B = c[(c[G + 1672 >> 2] | 0) + (A << 2) >> 2] | 0;
                J = E + 13120 | 0;
                I = E + 13080 | 0;
                H = c[I >> 2] | 0;
                n = q + (c[J >> 2] | 0) >> H;
                z = ((B | 0) % (n | 0) | 0) << H;
                n = ((B | 0) / (n | 0) | 0) << H;
                C = c[s >> 2] | 0;
                H = 1 << H;
                F = c[r >> 2] | 0;
                D = B - F | 0;
                c[(c[m >> 2] | 0) + (B << 2) >> 2] = F;
                do
                    if (!(a[G + 43 >> 0] | 0)) {
                        if (!(a[G + 42 >> 0] | 0)) {
                            c[C + 312 >> 2] = c[J >> 2];
                            G = E;
                            break
                        }
                        if ((A | 0) != 0 ? (W = c[G + 1676 >> 2] | 0, (c[W + (A << 2) >> 2] | 0) != (c[W + (A + -1 << 2) >> 2] | 0)) : 0) {
                            W = c[I >> 2] | 0;
                            c[C + 312 >> 2] = (c[(c[G + 1648 >> 2] | 0) + (c[(c[G + 1664 >> 2] | 0) + (z >> W << 2) >> 2] << 2) >> 2] << W) + z;
                            a[C + 203 >> 0] = 1;
                            G = c[k >> 2] | 0
                        } else G = E
                    } else {
                        if ((z | 0) == 0 ? (H + -1 & n | 0) == 0 : 0) {
                            a[C + 203 >> 0] = 1;
                            E = c[k >> 2] | 0
                        }
                        c[C + 312 >> 2] = c[E + 13120 >> 2];
                        G = E
                    }
                while (0);
                E = H + n | 0;
                H = c[G + 13124 >> 2] | 0;
                c[C + 316 >> 2] = (E | 0) > (H | 0) ? H : E;
                E = C + 31312 | 0;
                c[E >> 2] = 0;
                H = c[l >> 2] | 0;
                if (!(a[H + 42 >> 0] | 0)) {
                    if ((B | 0) == (F | 0)) {
                        c[E >> 2] = 1;
                        F = 1
                    } else F = 0;
                    if ((D | 0) < (c[G + 13128 >> 2] | 0)) {
                        F = F | 4;
                        c[E >> 2] = F
                    }
                } else {
                    if ((z | 0) > 0) {
                        W = c[H + 1676 >> 2] | 0;
                        I = B + -1 | 0;
                        if ((c[W + (A << 2) >> 2] | 0) == (c[W + (c[(c[H + 1668 >> 2] | 0) + (I << 2) >> 2] << 2) >> 2] | 0)) F = 0;
                        else {
                            c[E >> 2] = 2;
                            F = 2
                        }
                        W = c[m >> 2] | 0;
                        if ((c[W + (B << 2) >> 2] | 0) != (c[W + (I << 2) >> 2] | 0)) {
                            F = F | 1;
                            c[E >> 2] = F
                        }
                    } else F = 0;
                    if ((n | 0) > 0) {
                        W = c[H + 1676 >> 2] | 0;
                        I = G + 13128 | 0;
                        G = c[I >> 2] | 0;
                        if ((c[W + (A << 2) >> 2] | 0) != (c[W + (c[(c[H + 1668 >> 2] | 0) + (B - G << 2) >> 2] << 2) >> 2] | 0)) {
                            F = F | 8;
                            c[E >> 2] = F;
                            G = c[I >> 2] | 0
                        }
                        W = c[m >> 2] | 0;
                        if ((c[W + (B << 2) >> 2] | 0) != (c[W + (B - G << 2) >> 2] | 0)) {
                            F = F | 4;
                            c[E >> 2] = F
                        }
                    }
                }
                E = (z | 0) > 0;
                if (E & (D | 0) > 0) G = (F >>> 1 & 1 ^ 1) & 255;
                else G = 0;
                a[C + 308 >> 0] = G;
                if ((n | 0) > 0) {
                    if ((D | 0) < (c[(c[k >> 2] | 0) + 13128 >> 2] | 0)) F = 0;
                    else F = (F >>> 3 & 1 ^ 1) & 255;
                    a[C + 309 >> 0] = F;
                    F = c[(c[k >> 2] | 0) + 13128 >> 2] | 0;
                    if ((D + 1 | 0) < (F | 0)) F = 0;
                    else {
                        W = c[l >> 2] | 0;
                        V = c[W + 1676 >> 2] | 0;
                        F = (c[V + (A << 2) >> 2] | 0) == (c[V + (c[(c[W + 1668 >> 2] | 0) + (B + 1 - F << 2) >> 2] << 2) >> 2] | 0) & 1
                    }
                    a[C + 310 >> 0] = F;
                    if (E ? (j = c[(c[k >> 2] | 0) + 13128 >> 2] | 0, (D | 0) > (j | 0)) : 0) {
                        D = c[l >> 2] | 0;
                        W = c[D + 1676 >> 2] | 0;
                        D = (c[W + (A << 2) >> 2] | 0) == (c[W + (c[(c[D + 1668 >> 2] | 0) + (B + -1 - j << 2) >> 2] << 2) >> 2] | 0) & 1
                    } else D = 0
                } else {
                    a[C + 309 >> 0] = 0;
                    a[C + 310 >> 0] = 0;
                    D = 0
                }
                a[C + 311 >> 0] = D;
                _a(h, A);
                D = c[k >> 2] | 0;
                E = c[D + 13080 >> 2] | 0;
                F = z >> E;
                E = n >> E;
                G = c[s >> 2] | 0;
                D = ($(c[D + 13128 >> 2] | 0, E) | 0) + F | 0;
                C = c[p >> 2] | 0;
                if ((a[y >> 0] | 0) == 0 ? (a[o >> 0] | 0) == 0 : 0) {
                    M = 0;
                    H = 0
                } else {
                    if ((F | 0) > 0 ? (a[G + 308 >> 0] | 0) != 0 : 0) M = db(h) | 0;
                    else M = 0;
                    if ((E | 0) > 0 & (M | 0) == 0)
                        if (!(a[G + 309 >> 0] | 0)) {
                            M = 0;
                            H = 0
                        } else {
                            M = 0;
                            H = (db(h) | 0) != 0
                        } else H = 0
                }
                I = (c[(c[k >> 2] | 0) + 4 >> 2] | 0) != 0 ? 3 : 1;
                L = C + (D * 148 | 0) + 143 | 0;
                G = C + (D * 148 | 0) + 144 | 0;
                K = C + (D * 148 | 0) + 104 | 0;
                J = C + (D * 148 | 0) + 108 | 0;
                R = (M | 0) == 0;
                S = R & (H ^ 1);
                M = E + -1 | 0;
                O = F + -1 | 0;
                P = 0;
                do {
                    Q = c[l >> 2] | 0;
                    Q = d[((P | 0) == 0 ? Q + 1644 | 0 : Q + 1645 | 0) >> 0] | 0;
                    a: do
                        if (a[h + P + 3044 >> 0] | 0) {
                            T = (P | 0) == 2;
                            do
                                if (!T) {
                                    if (S) {
                                        U = (fb(h) | 0) & 255;
                                        N = C + (D * 148 | 0) + P + 142 | 0;
                                        a[N >> 0] = U;
                                        break
                                    }
                                    if (!R) {
                                        U = ($(c[(c[k >> 2] | 0) + 13128 >> 2] | 0, E) | 0) + O | 0;
                                        U = a[(c[p >> 2] | 0) + (U * 148 | 0) + P + 142 >> 0] | 0;
                                        N = C + (D * 148 | 0) + P + 142 | 0;
                                        a[N >> 0] = U;
                                        break
                                    }
                                    if (H) {
                                        U = ($(c[(c[k >> 2] | 0) + 13128 >> 2] | 0, M) | 0) + F | 0;
                                        U = a[(c[p >> 2] | 0) + (U * 148 | 0) + P + 142 >> 0] | 0;
                                        N = C + (D * 148 | 0) + P + 142 | 0;
                                        a[N >> 0] = U;
                                        break
                                    } else {
                                        a[C + (D * 148 | 0) + P + 142 >> 0] = 0;
                                        break a
                                    }
                                } else {
                                    U = a[L >> 0] | 0;
                                    a[G >> 0] = U;
                                    c[J >> 2] = c[K >> 2];
                                    N = G
                                }
                            while (0);
                            if (U << 24 >> 24) {
                                U = 0;
                                do {
                                    do
                                        if (!S) {
                                            if (!R) {
                                                W = ($(c[(c[k >> 2] | 0) + 13128 >> 2] | 0, E) | 0) + O | 0;
                                                c[C + (D * 148 | 0) + (P << 4) + (U << 2) >> 2] = c[(c[p >> 2] | 0) + (W * 148 | 0) + (P << 4) + (U << 2) >> 2];
                                                break
                                            }
                                            if (H) {
                                                W = ($(c[(c[k >> 2] | 0) + 13128 >> 2] | 0, M) | 0) + F | 0;
                                                c[C + (D * 148 | 0) + (P << 4) + (U << 2) >> 2] = c[(c[p >> 2] | 0) + (W * 148 | 0) + (P << 4) + (U << 2) >> 2];
                                                break
                                            } else {
                                                c[C + (D * 148 | 0) + (P << 4) + (U << 2) >> 2] = 0;
                                                break
                                            }
                                        } else c[C + (D * 148 | 0) + (P << 4) + (U << 2) >> 2] = ib(h) | 0;
                                    while (0);
                                    U = U + 1 | 0
                                } while ((U | 0) != 4);
                                do
                                    if ((a[N >> 0] | 0) == 1) {
                                        T = 0;
                                        do {
                                            do
                                                if (c[C + (D * 148 | 0) + (P << 4) + (T << 2) >> 2] | 0) {
                                                    if (S) {
                                                        c[C + (D * 148 | 0) + (P << 4) + (T << 2) + 48 >> 2] = jb(h) | 0;
                                                        break
                                                    }
                                                    if (!R) {
                                                        W = ($(c[(c[k >> 2] | 0) + 13128 >> 2] | 0, E) | 0) + O | 0;
                                                        c[C + (D * 148 | 0) + (P << 4) + (T << 2) + 48 >> 2] = c[(c[p >> 2] | 0) + (W * 148 | 0) + (P << 4) + (T << 2) + 48 >> 2];
                                                        break
                                                    }
                                                    if (H) {
                                                        W = ($(c[(c[k >> 2] | 0) + 13128 >> 2] | 0, M) | 0) + F | 0;
                                                        c[C + (D * 148 | 0) + (P << 4) + (T << 2) + 48 >> 2] = c[(c[p >> 2] | 0) + (W * 148 | 0) + (P << 4) + (T << 2) + 48 >> 2];
                                                        break
                                                    } else {
                                                        c[C + (D * 148 | 0) + (P << 4) + (T << 2) + 48 >> 2] = 0;
                                                        break
                                                    }
                                                } else c[C + (D * 148 | 0) + (P << 4) + (T << 2) + 48 >> 2] = 0;
                                            while (0);
                                            T = T + 1 | 0
                                        } while ((T | 0) != 4);
                                        if (S) {
                                            a[C + (D * 148 | 0) + P + 96 >> 0] = hb(h) | 0;
                                            break
                                        }
                                        if (!R) {
                                            W = ($(c[(c[k >> 2] | 0) + 13128 >> 2] | 0, E) | 0) + O | 0;
                                            a[C + (D * 148 | 0) + P + 96 >> 0] = a[(c[p >> 2] | 0) + (W * 148 | 0) + P + 96 >> 0] | 0;
                                            break
                                        }
                                        if (H) {
                                            W = ($(c[(c[k >> 2] | 0) + 13128 >> 2] | 0, M) | 0) + F | 0;
                                            a[C + (D * 148 | 0) + P + 96 >> 0] = a[(c[p >> 2] | 0) + (W * 148 | 0) + P + 96 >> 0] | 0;
                                            break
                                        } else {
                                            a[C + (D * 148 | 0) + P + 96 >> 0] = 0;
                                            break
                                        }
                                    } else if (!T) {
                                    if (S) {
                                        c[C + (D * 148 | 0) + (P << 2) + 100 >> 2] = kb(h) | 0;
                                        break
                                    }
                                    if (!R) {
                                        W = ($(c[(c[k >> 2] | 0) + 13128 >> 2] | 0, E) | 0) + O | 0;
                                        c[C + (D * 148 | 0) + (P << 2) + 100 >> 2] = c[(c[p >> 2] | 0) + (W * 148 | 0) + (P << 2) + 100 >> 2];
                                        break
                                    }
                                    if (H) {
                                        W = ($(c[(c[k >> 2] | 0) + 13128 >> 2] | 0, M) | 0) + F | 0;
                                        c[C + (D * 148 | 0) + (P << 2) + 100 >> 2] = c[(c[p >> 2] | 0) + (W * 148 | 0) + (P << 2) + 100 >> 2];
                                        break
                                    } else {
                                        c[C + (D * 148 | 0) + (P << 2) + 100 >> 2] = 0;
                                        break
                                    }
                                } while (0);
                                b[C + (D * 148 | 0) + (P * 10 | 0) + 112 >> 1] = 0;
                                T = 0;
                                do {
                                    W = c[C + (D * 148 | 0) + (P << 4) + (T << 2) >> 2] | 0;
                                    V = T;
                                    T = T + 1 | 0;
                                    U = C + (D * 148 | 0) + (P * 10 | 0) + (T << 1) + 112 | 0;
                                    b[U >> 1] = W;
                                    if ((a[N >> 0] | 0) == 2) {
                                        if ((V | 0) > 1) {
                                            W = 0 - W | 0;
                                            b[U >> 1] = W
                                        }
                                    } else if (c[C + (D * 148 | 0) + (P << 4) + (V << 2) + 48 >> 2] | 0) {
                                        W = 0 - W | 0;
                                        b[U >> 1] = W
                                    }
                                    b[U >> 1] = W << 16 >> 16 << Q
                                } while ((T | 0) != 4)
                            }
                        } else a[C + (D * 148 | 0) + P + 142 >> 0] = 0;
                    while (0);
                    P = P + 1 | 0
                } while ((P | 0) < (I | 0));
                C = c[x >> 2] | 0;
                c[C + (B << 3) >> 2] = c[w >> 2];
                c[C + (B << 3) + 4 >> 2] = c[v >> 2];
                a[(c[t >> 2] | 0) + B >> 0] = a[u >> 0] | 0;
                C = ec(h, z, n, c[(c[k >> 2] | 0) + 13080 >> 2] | 0, 0) | 0;
                if ((C | 0) < 0) {
                    g = 108;
                    break
                }
                A = A + 1 | 0;
                Za(h, A);
                Tb(h, z, n, e);
                E = c[k >> 2] | 0
            } while ((C | 0) != 0);
            if ((g | 0) == 108) {
                c[(c[m >> 2] | 0) + (B << 2) >> 2] = -1;
                W = C;
                i = f;
                return W | 0
            }
            if ((z + e | 0) < (c[E + 13120 >> 2] | 0)) {
                W = A;
                i = f;
                return W | 0
            }
            if ((n + e | 0) < (c[E + 13124 >> 2] | 0)) {
                W = A;
                i = f;
                return W | 0
            }
            Rb(h, z, n, e);
            W = A;
            i = f;
            return W | 0
        }

        function ec(b, e, f, g, h) {
            b = b | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            var j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                D = 0,
                E = 0,
                F = 0,
                G = 0,
                H = 0,
                I = 0,
                J = 0,
                K = 0,
                L = 0,
                M = 0,
                N = 0,
                O = 0,
                P = 0,
                Q = 0,
                R = 0,
                S = 0,
                T = 0,
                U = 0,
                V = 0,
                W = 0,
                X = 0,
                Y = 0,
                Z = 0,
                _ = 0;
            j = i;
            i = i + 32 | 0;
            z = j;
            C = j + 20 | 0;
            B = b + 136 | 0;
            p = c[B >> 2] | 0;
            k = 1 << g;
            m = b + 200 | 0;
            s = c[m >> 2] | 0;
            q = b + 204 | 0;
            t = c[q >> 2] | 0;
            r = (1 << (c[s + 13080 >> 2] | 0) - (c[t + 24 >> 2] | 0)) + -1 | 0;
            c[p + 31232 >> 2] = h;
            l = k + e | 0;
            if (((l | 0) <= (c[s + 13120 >> 2] | 0) ? (k + f | 0) <= (c[s + 13124 >> 2] | 0) : 0) ? (c[s + 13064 >> 2] | 0) >>> 0 < g >>> 0 : 0) {
                s = tb(b, h, e, f) | 0;
                t = c[q >> 2] | 0
            } else s = (c[s + 13064 >> 2] | 0) >>> 0 < g >>> 0 & 1;
            if ((a[t + 22 >> 0] | 0) != 0 ? ((c[(c[m >> 2] | 0) + 13080 >> 2] | 0) - (c[t + 24 >> 2] | 0) | 0) >>> 0 <= g >>> 0 : 0) {
                a[p + 300 >> 0] = 0;
                c[p + 280 >> 2] = 0
            }
            if ((a[b + 3068 >> 0] | 0) != 0 ? ((c[(c[m >> 2] | 0) + 13080 >> 2] | 0) - (d[(c[q >> 2] | 0) + 1632 >> 0] | 0) | 0) >>> 0 <= g >>> 0 : 0) a[p + 301 >> 0] = 0;
            if (s) {
                n = k >> 1;
                q = n + e | 0;
                o = n + f | 0;
                g = g + -1 | 0;
                h = h + 1 | 0;
                s = ec(b, e, f, g, h) | 0;
                if ((s | 0) < 0) {
                    _ = s;
                    i = j;
                    return _ | 0
                }
                if (s) {
                    if ((q | 0) < (c[(c[m >> 2] | 0) + 13120 >> 2] | 0)) {
                        s = ec(b, q, f, g, h) | 0;
                        if ((s | 0) < 0) {
                            _ = s;
                            i = j;
                            return _ | 0
                        }
                    }
                    if (s) {
                        if ((o | 0) < (c[(c[m >> 2] | 0) + 13124 >> 2] | 0)) {
                            s = ec(b, e, o, g, h) | 0;
                            if ((s | 0) < 0) {
                                _ = s;
                                i = j;
                                return _ | 0
                            }
                        }
                        if (s) {
                            _ = c[m >> 2] | 0;
                            if ((q | 0) < (c[_ + 13120 >> 2] | 0) ? (o | 0) < (c[_ + 13124 >> 2] | 0) : 0) {
                                s = ec(b, q, o, g, h) | 0;
                                if ((s | 0) < 0) {
                                    _ = s;
                                    i = j;
                                    return _ | 0
                                }
                            }
                        } else s = 0
                    } else s = 0
                } else s = 0;
                if ((r & l | 0) == 0 ? (r & k + f | 0) == 0 : 0) c[p + 276 >> 2] = a[p + 272 >> 0];
                if (!s) {
                    _ = 0;
                    i = j;
                    return _ | 0
                }
                k = c[m >> 2] | 0;
                if ((q + n | 0) < (c[k + 13120 >> 2] | 0)) k = 1;
                else k = (o + n | 0) < (c[k + 13124 >> 2] | 0);
                _ = k & 1;
                i = j;
                return _ | 0
            }
            p = c[B >> 2] | 0;
            s = c[m >> 2] | 0;
            r = c[s + 13064 >> 2] | 0;
            h = c[s + 13140 >> 2] | 0;
            G = e >> r;
            F = f >> r;
            s = 1 << (c[s + 13080 >> 2] | 0) - (c[(c[q >> 2] | 0) + 24 >> 2] | 0);
            c[p + 31236 >> 2] = e;
            c[p + 31240 >> 2] = f;
            y = p + 31252 | 0;
            a[y >> 0] = 1;
            v = p + 31244 | 0;
            c[v >> 2] = 1;
            x = p + 31248 | 0;
            c[x >> 2] = 0;
            u = p + 31254 | 0;
            a[u >> 0] = 0;
            w = p + 31253 | 0;
            a[w >> 0] = 0;
            t = ($(F, h) | 0) + G | 0;
            E = b + 7584 | 0;
            a[(c[E >> 2] | 0) + t >> 0] = 0;
            _ = p + 31268 | 0;
            a[_ >> 0] = 1;
            a[_ + 1 >> 0] = 1;
            a[_ + 2 >> 0] = 1;
            a[_ + 3 >> 0] = 1;
            r = k >> r;
            s = s + -1 | 0;
            if (a[(c[q >> 2] | 0) + 40 >> 0] | 0) {
                _ = (mb(b) | 0) & 255;
                a[p + 31256 >> 0] = _;
                if (_ << 24 >> 24) fc(b, e, f, g)
            } else a[p + 31256 >> 0] = 0;
            A = b + 2428 | 0;
            if ((c[A >> 2] | 0) == 2) {
                if ((r | 0) > 0) {
                    G = t;
                    F = 0;
                    while (1) {
                        jf((c[E >> 2] | 0) + G | 0, 0, r | 0) | 0;
                        F = F + 1 | 0;
                        if ((F | 0) == (r | 0)) break;
                        else G = G + h | 0
                    }
                }
            } else {
                H = nb(b, e, f, G, F) | 0;
                I = H & 255;
                if ((r | 0) > 0) {
                    F = t;
                    G = 0;
                    while (1) {
                        jf((c[E >> 2] | 0) + F | 0, I | 0, r | 0) | 0;
                        G = G + 1 | 0;
                        if ((G | 0) == (r | 0)) break;
                        else F = F + h | 0
                    }
                }
                c[v >> 2] = (H & 255 | 0) != 0 ? 2 : 0
            }
            do
                if (!(a[(c[E >> 2] | 0) + t >> 0] | 0)) {
                    if ((c[A >> 2] | 0) == 2) A = c[v >> 2] | 0;
                    else {
                        A = sb(b) | 0;
                        c[v >> 2] = A
                    }
                    if ((A | 0) == 1 ? (c[(c[m >> 2] | 0) + 13064 >> 2] | 0) != (g | 0) : 0) {
                        E = c[x >> 2] | 0;
                        A = 53
                    } else A = 50;
                    a: do
                        if ((A | 0) == 50) {
                            E = ub(b, g) | 0;
                            c[x >> 2] = E;
                            G = c[v >> 2] | 0;
                            if ((E | 0) == 3) F = (G | 0) == 1 & 1;
                            else F = 0;
                            a[u >> 0] = F;
                            if ((G | 0) == 1) A = 53;
                            else {
                                hc(b, e, f, g);
                                switch (c[x >> 2] | 0) {
                                    case 0:
                                        {
                                            gc(b, e, f, k, k, g, 0);
                                            break a
                                        };
                                    case 1:
                                        {
                                            _ = (k | 0) / 2 | 0;
                                            gc(b, e, f, k, _, g, 0);
                                            gc(b, e, _ + f | 0, k, _, g, 1);
                                            break a
                                        };
                                    case 2:
                                        {
                                            _ = (k | 0) / 2 | 0;
                                            gc(b, e, f, _, k, g, 0);
                                            gc(b, _ + e | 0, f, _, k, g, 1);
                                            break a
                                        };
                                    case 4:
                                        {
                                            _ = (k | 0) / 4 | 0;
                                            gc(b, e, f, k, _, g, 0);
                                            gc(b, e, _ + f | 0, k, (3 << g | 0) / 4 | 0, g, 1);
                                            break a
                                        };
                                    case 5:
                                        {
                                            _ = (3 << g | 0) / 4 | 0;
                                            gc(b, e, f, k, _, g, 0);
                                            gc(b, e, _ + f | 0, k, (k | 0) / 4 | 0, g, 1);
                                            break a
                                        };
                                    case 6:
                                        {
                                            _ = (k | 0) / 4 | 0;
                                            gc(b, e, f, _, k, g, 0);
                                            gc(b, _ + e | 0, f, (3 << g | 0) / 4 | 0, k, g, 1);
                                            break a
                                        };
                                    case 7:
                                        {
                                            _ = (3 << g | 0) / 4 | 0;
                                            gc(b, e, f, _, k, g, 0);
                                            gc(b, _ + e | 0, f, (k | 0) / 4 | 0, k, g, 1);
                                            break a
                                        };
                                    case 3:
                                        {
                                            _ = (k | 0) / 2 | 0;
                                            gc(b, e, f, _, _, g, 0);
                                            Y = _ + e | 0;
                                            gc(b, Y, f, _, _, g, 1);
                                            Z = _ + f | 0;
                                            gc(b, e, Z, _, _, g, 2);
                                            gc(b, Y, Z, _, _, g, 3);
                                            break a
                                        };
                                    default:
                                        break a
                                }
                            }
                        }
                    while (0);
                    do
                        if ((A | 0) == 53) {
                            if ((((E | 0) == 0 ? (D = c[m >> 2] | 0, (c[D + 68 >> 2] | 0) != 0) : 0) ? (c[D + 13048 >> 2] | 0) >>> 0 <= g >>> 0 : 0) ? (c[D + 13052 >> 2] | 0) >>> 0 >= g >>> 0 : 0) {
                                D = (vb(b) | 0) & 255;
                                a[w >> 0] = D
                            } else D = a[w >> 0] | 0;
                            if (D << 24 >> 24) {
                                hc(b, e, f, g);
                                I = c[B >> 2] | 0;
                                Y = c[b + 160 >> 2] | 0;
                                G = c[Y + 32 >> 2] | 0;
                                F = $(G, f) | 0;
                                J = c[m >> 2] | 0;
                                E = c[J + 56 >> 2] | 0;
                                F = (c[Y >> 2] | 0) + ((e << E) + F) | 0;
                                B = c[Y + 36 >> 2] | 0;
                                L = c[J + 13184 >> 2] | 0;
                                H = $(f >> L, B) | 0;
                                K = c[J + 13172 >> 2] | 0;
                                H = (c[Y + 4 >> 2] | 0) + ((e >> K << E) + H) | 0;
                                D = c[Y + 40 >> 2] | 0;
                                _ = c[J + 13188 >> 2] | 0;
                                C = $(f >> _, D) | 0;
                                Z = c[J + 13176 >> 2] | 0;
                                C = (c[Y + 8 >> 2] | 0) + ((e >> Z << E) + C) | 0;
                                E = $(d[J + 13044 >> 0] | 0, k << g) | 0;
                                L = ($(k >> Z, k >> _) | 0) + ($(k >> K, k >> L) | 0) | 0;
                                E = ($(d[J + 13045 >> 0] | 0, L) | 0) + E | 0;
                                L = I + 224 | 0;
                                J = E + 7 >> 3;
                                K = c[I + 240 >> 2] | 0;
                                _ = c[L >> 2] | 0;
                                K = (_ & 1 | 0) == 0 ? K : K + -1 | 0;
                                K = (_ & 511 | 0) == 0 ? K : K + -1 | 0;
                                I = (c[I + 244 >> 2] | 0) - K | 0;
                                if ((I | 0) < (J | 0)) K = 0;
                                else Vd(L, K + J | 0, I - J | 0);
                                if (!(a[b + 3049 >> 0] | 0)) Pb(b, e, f, g);
                                _ = E >>> 0 > 2147483639 | (K | 0) == 0;
                                Z = _ ? 0 : E;
                                Y = _ ? 0 : K;
                                c[z >> 2] = Y;
                                c[z + 12 >> 2] = Z;
                                c[z + 16 >> 2] = Z + 8;
                                c[z + 4 >> 2] = Y + (Z + 7 >> 3);
                                c[z + 8 >> 2] = 0;
                                if (_) z = -1094995529;
                                else {
                                    Z = b + 5852 | 0;
                                    Na[c[Z >> 2] & 3](F, G, k, k, z, d[(c[m >> 2] | 0) + 13044 >> 0] | 0);
                                    _ = c[m >> 2] | 0;
                                    Na[c[Z >> 2] & 3](H, B, k >> c[_ + 13172 >> 2], k >> c[_ + 13184 >> 2], z, d[_ + 13045 >> 0] | 0);
                                    _ = c[m >> 2] | 0;
                                    Na[c[Z >> 2] & 3](C, D, k >> c[_ + 13176 >> 2], k >> c[_ + 13188 >> 2], z, d[_ + 13045 >> 0] | 0);
                                    z = 0
                                }
                                if (a[(c[m >> 2] | 0) + 13056 >> 0] | 0) fc(b, e, f, g);
                                if ((z | 0) >= 0) break;
                                i = j;
                                return z | 0
                            }
                            D = c[B >> 2] | 0;
                            G = (c[D + 31248 >> 2] | 0) == 3;
                            E = G ? 2 : 1;
                            F = 0;
                            do {
                                H = F << 1;
                                I = 0;
                                do {
                                    a[C + (I + H) >> 0] = wb(b) | 0;
                                    I = I + 1 | 0
                                } while ((I | 0) < (E | 0));
                                F = F + 1 | 0
                            } while ((F | 0) < (E | 0));
                            K = k >> (G & 1);
                            J = D + 31264 | 0;
                            L = b + 3508 | 0;
                            T = z + 4 | 0;
                            Q = z + 8 | 0;
                            M = b + 7592 | 0;
                            I = D + 31260 | 0;
                            H = 0;
                            do {
                                F = H << 1;
                                G = ($(H, K) | 0) + f | 0;
                                R = 0;
                                do {
                                    P = R + F | 0;
                                    X = (a[C + P >> 0] | 0) == 0;
                                    if (X) c[J >> 2] = yb(b) | 0;
                                    else c[I >> 2] = xb(b) | 0;
                                    U = ($(R, K) | 0) + e | 0;
                                    W = c[B >> 2] | 0;
                                    Y = c[m >> 2] | 0;
                                    V = c[Y + 13084 >> 2] | 0;
                                    O = U >> V;
                                    S = G >> V;
                                    N = c[Y + 13156 >> 2] | 0;
                                    V = K >> V;
                                    Y = c[Y + 13080 >> 2] | 0;
                                    _ = (1 << Y) + -1 | 0;
                                    U = _ & U;
                                    if ((a[W + 309 >> 0] | 0) == 0 ? (_ & G | 0) == 0 : 0) _ = 1;
                                    else {
                                        _ = ($(S + -1 | 0, N) | 0) + O | 0;
                                        _ = d[(c[M >> 2] | 0) + _ >> 0] | 0
                                    }
                                    if ((a[W + 308 >> 0] | 0) == 0 & (U | 0) == 0) Z = 1;
                                    else {
                                        Z = O + -1 + ($(S, N) | 0) | 0;
                                        Z = d[(c[M >> 2] | 0) + Z >> 0] | 0
                                    }
                                    U = c[(c[L >> 2] | 0) + 16 >> 2] | 0;
                                    _ = (G >> Y << Y | 0) < (G | 0) ? _ : 1;
                                    do
                                        if ((Z | 0) == (_ | 0))
                                            if (Z >>> 0 < 2) {
                                                c[z >> 2] = 0;
                                                c[T >> 2] = 1;
                                                c[Q >> 2] = 26;
                                                Z = 0;
                                                _ = 1;
                                                Y = 26;
                                                break
                                            } else {
                                                c[z >> 2] = Z;
                                                _ = (Z + 29 & 31) + 2 | 0;
                                                c[T >> 2] = _;
                                                Y = (Z + 31 & 31) + 2 | 0;
                                                c[Q >> 2] = Y;
                                                break
                                            } else {
                                        c[z >> 2] = Z;
                                        c[T >> 2] = _;
                                        if (!((Z | 0) == 0 | (_ | 0) == 0)) {
                                            c[Q >> 2] = 0;
                                            Y = 0;
                                            break
                                        }
                                        if ((Z | 0) == 1 | (_ | 0) == 1) {
                                            c[Q >> 2] = 26;
                                            Y = 26;
                                            break
                                        } else {
                                            c[Q >> 2] = 1;
                                            Y = 1;
                                            break
                                        }
                                    } while (0);
                                    if (X) {
                                        if ((Z | 0) > (_ | 0)) {
                                            c[T >> 2] = Z;
                                            X = _ & 255;
                                            c[z >> 2] = X
                                        } else {
                                            X = Z;
                                            Z = _
                                        }
                                        if ((X | 0) > (Y | 0)) {
                                            c[Q >> 2] = X;
                                            _ = Y & 255;
                                            c[z >> 2] = _;
                                            Y = X;
                                            X = _
                                        }
                                        if ((Z | 0) > (Y | 0)) {
                                            c[Q >> 2] = Z;
                                            _ = Y & 255;
                                            c[T >> 2] = _;
                                            Y = Z
                                        } else _ = Z;
                                        W = c[W + 31264 >> 2] | 0;
                                        W = ((W | 0) >= (X | 0) & 1) + W | 0;
                                        W = ((W | 0) >= (_ | 0) & 1) + W | 0;
                                        W = ((W | 0) >= (Y | 0) & 1) + W | 0
                                    } else W = c[z + (c[W + 31260 >> 2] << 2) >> 2] | 0;
                                    V = (V | 0) == 0 ? 1 : V;
                                    W = W & 255;
                                    if ((V | 0) > 0) {
                                        X = 0;
                                        do {
                                            Y = ($(X + S | 0, N) | 0) + O | 0;
                                            jf((c[M >> 2] | 0) + Y | 0, W | 0, V | 0) | 0;
                                            Y = X + O | 0;
                                            Z = 0;
                                            do {
                                                a[U + ((Y + ($(Z + S | 0, N) | 0) | 0) * 12 | 0) + 10 >> 0] = 0;
                                                Z = Z + 1 | 0
                                            } while ((Z | 0) < (V | 0));
                                            X = X + 1 | 0
                                        } while ((X | 0) < (V | 0))
                                    }
                                    a[D + P + 31268 >> 0] = W;
                                    R = R + 1 | 0
                                } while ((R | 0) < (E | 0));
                                H = H + 1 | 0
                            } while ((H | 0) < (E | 0));
                            z = c[(c[m >> 2] | 0) + 4 >> 2] | 0;
                            if ((z | 0) == 3) {
                                z = 0;
                                do {
                                    B = z << 1;
                                    C = 0;
                                    do {
                                        G = zb(b) | 0;
                                        H = C + B | 0;
                                        a[D + H + 31281 >> 0] = G;
                                        F = a[D + H + 31268 >> 0] | 0;
                                        do
                                            if ((G | 0) != 4) {
                                                G = a[1600 + G >> 0] | 0;
                                                H = D + H + 31277 | 0;
                                                if (F << 24 >> 24 == G << 24 >> 24) {
                                                    a[H >> 0] = 34;
                                                    break
                                                } else {
                                                    a[H >> 0] = G;
                                                    break
                                                }
                                            } else a[D + H + 31277 >> 0] = F;
                                        while (0);
                                        C = C + 1 | 0
                                    } while ((C | 0) < (E | 0));
                                    z = z + 1 | 0
                                } while ((z | 0) < (E | 0))
                            } else if (!z) break;
                            else if ((z | 0) != 2) {
                                B = zb(b) | 0;
                                z = a[D + 31268 >> 0] | 0;
                                if ((B | 0) == 4) {
                                    a[D + 31277 >> 0] = z;
                                    break
                                }
                                B = a[1600 + B >> 0] | 0;
                                C = D + 31277 | 0;
                                if (z << 24 >> 24 == B << 24 >> 24) {
                                    a[C >> 0] = 34;
                                    break
                                } else {
                                    a[C >> 0] = B;
                                    break
                                }
                            } else {
                                B = zb(b) | 0;
                                a[D + 31281 >> 0] = B;
                                z = a[D + 31268 >> 0] | 0;
                                if ((B | 0) == 4) z = z & 255;
                                else {
                                    _ = a[1600 + B >> 0] | 0;
                                    z = z << 24 >> 24 == _ << 24 >> 24 ? 34 : _ & 255
                                }
                                a[D + 31277 >> 0] = a[1608 + z >> 0] | 0;
                                break
                            }
                        }
                    while (0);
                    if (!(a[w >> 0] | 0)) {
                        do
                            if ((c[v >> 2] | 0) == 1) A = 139;
                            else {
                                if ((c[x >> 2] | 0) == 0 ? (a[p + 31276 >> 0] | 0) != 0 : 0) {
                                    A = 139;
                                    break
                                }
                                w = (Fb(b) | 0) & 255;
                                a[y >> 0] = w
                            }
                        while (0);
                        if ((A | 0) == 139) w = a[y >> 0] | 0;
                        if (!(w << 24 >> 24)) {
                            if (a[b + 3049 >> 0] | 0) break;
                            Pb(b, e, f, g);
                            break
                        }
                        w = c[m >> 2] | 0;
                        if ((c[v >> 2] | 0) == 1) u = (d[u >> 0] | 0) + (c[w + 13092 >> 2] | 0) | 0;
                        else u = c[w + 13088 >> 2] | 0;
                        a[p + 31255 >> 0] = u;
                        u = ic(b, e, f, e, f, e, f, g, g, 0, 0, 1592, 1592) | 0;
                        if ((u | 0) < 0) {
                            _ = u;
                            i = j;
                            return _ | 0
                        }
                    }
                } else {
                    gc(b, e, f, k, k, g, 0);
                    hc(b, e, f, g);
                    if (!(a[b + 3049 >> 0] | 0)) Pb(b, e, f, g)
                }
            while (0);
            if ((a[(c[q >> 2] | 0) + 22 >> 0] | 0) != 0 ? (a[p + 300 >> 0] | 0) == 0 : 0) Ob(b, e, f, g);
            if ((r | 0) > 0) {
                q = b + 7568 | 0;
                g = p + 272 | 0;
                u = 0;
                while (1) {
                    jf((c[q >> 2] | 0) + t | 0, a[g >> 0] | 0, r | 0) | 0;
                    u = u + 1 | 0;
                    if ((u | 0) == (r | 0)) break;
                    else t = t + h | 0
                }
            }
            if ((s & l | 0) == 0 ? (s & k + f | 0) == 0 : 0) c[p + 276 >> 2] = a[p + 272 >> 0];
            r = c[m >> 2] | 0;
            _ = c[r + 13064 >> 2] | 0;
            g = k >> _;
            q = e >> _;
            e = f >> _;
            if ((g | 0) > 0 ? (n = b + 7588 | 0, o = c[p + 31232 >> 2] & 255, _ = ($(c[r + 13140 >> 2] | 0, e) | 0) + q | 0, jf((c[n >> 2] | 0) + _ | 0, o | 0, g | 0) | 0, (g | 0) != 1) : 0) {
                p = 1;
                do {
                    _ = ($(c[(c[m >> 2] | 0) + 13140 >> 2] | 0, p + e | 0) | 0) + q | 0;
                    jf((c[n >> 2] | 0) + _ | 0, o | 0, g | 0) | 0;
                    p = p + 1 | 0
                } while ((p | 0) != (g | 0))
            }
            m = c[m >> 2] | 0;
            e = 1 << c[m + 13080 >> 2];
            if (((l | 0) % (e | 0) | 0 | 0) != 0 ? (l | 0) < (c[m + 13120 >> 2] | 0) : 0) {
                _ = 1;
                i = j;
                return _ | 0
            }
            _ = k + f | 0;
            if (((_ | 0) % (e | 0) | 0 | 0) != 0 ? (_ | 0) < (c[m + 13124 >> 2] | 0) : 0) {
                _ = 1;
                i = j;
                return _ | 0
            }
            _ = (lb(b) | 0) == 0 & 1;
            i = j;
            return _ | 0
        }

        function fc(b, d, e, f) {
            b = b | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            var g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0;
            g = i;
            m = 1 << f;
            n = c[b + 200 >> 2] | 0;
            l = c[n + 13084 >> 2] | 0;
            f = c[n + 13156 >> 2] | 0;
            k = m + d | 0;
            j = c[n + 13120 >> 2] | 0;
            m = m + e | 0;
            n = c[n + 13124 >> 2] | 0;
            h = e >> l;
            e = ((m | 0) > (n | 0) ? n : m) >> l;
            if ((h | 0) >= (e | 0)) {
                i = g;
                return
            }
            d = d >> l;
            j = ((k | 0) > (j | 0) ? j : k) >> l;
            k = (d | 0) < (j | 0);
            b = b + 7600 | 0;
            do {
                if (k) {
                    m = $(h, f) | 0;
                    l = d;
                    do {
                        a[(c[b >> 2] | 0) + (l + m) >> 0] = 2;
                        l = l + 1 | 0
                    } while ((l | 0) != (j | 0))
                }
                h = h + 1 | 0
            } while ((h | 0) != (e | 0));
            i = g;
            return
        }

        function gc(f, g, h, j, k, l, m) {
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            m = m | 0;
            var n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0;
            r = i;
            i = i + 16 | 0;
            n = r;
            x = c[f + 136 >> 2] | 0;
            c[n + 0 >> 2] = c[412];
            c[n + 4 >> 2] = c[413];
            c[n + 8 >> 2] = c[414];
            s = f + 200 | 0;
            A = c[s >> 2] | 0;
            w = c[A + 13156 >> 2] | 0;
            u = c[f + 3508 >> 2] | 0;
            v = c[u + 16 >> 2] | 0;
            u = c[u + 20 >> 2] | 0;
            o = f + 160 | 0;
            z = c[o >> 2] | 0;
            t = $(c[z + 32 >> 2] | 0, h >> c[A + 13180 >> 2]) | 0;
            B = c[A + 56 >> 2] | 0;
            t = (c[z >> 2] | 0) + ((g >> c[A + 13168 >> 2] << B) + t) | 0;
            q = $(h >> c[A + 13184 >> 2], c[z + 36 >> 2] | 0) | 0;
            q = (c[z + 4 >> 2] | 0) + ((g >> c[A + 13172 >> 2] << B) + q) | 0;
            p = $(h >> c[A + 13188 >> 2], c[z + 40 >> 2] | 0) | 0;
            p = (c[z + 8 >> 2] | 0) + ((g >> c[A + 13176 >> 2] << B) + p) | 0;
            B = c[A + 13064 >> 2] | 0;
            B = ($(h >> B, c[A + 13140 >> 2] | 0) | 0) + (g >> B) | 0;
            a: do
                if (!(a[(c[f + 7584 >> 2] | 0) + B >> 0] | 0)) {
                    B = (Bb(f) | 0) & 255;
                    a[x + 31276 >> 0] = B;
                    if (B << 24 >> 24) {
                        if ((c[f + 3080 >> 2] | 0) >>> 0 > 1) x = Ab(f) | 0;
                        else x = 0;
                        rd(f, g, h, j, k, l, m, x, n);
                        A = c[(c[s >> 2] | 0) + 13084 >> 2] | 0;
                        m = g >> A;
                        l = h >> A;
                        if ((k >> A | 0) > 0) x = 0;
                        else break;
                        while (1) {
                            if ((j >> A | 0) > 0) {
                                z = ($(x + l | 0, w) | 0) + m | 0;
                                y = 0;
                                do {
                                    A = v + ((z + y | 0) * 12 | 0) | 0;
                                    c[A + 0 >> 2] = c[n + 0 >> 2];
                                    c[A + 4 >> 2] = c[n + 4 >> 2];
                                    c[A + 8 >> 2] = c[n + 8 >> 2];
                                    y = y + 1 | 0;
                                    A = c[(c[s >> 2] | 0) + 13084 >> 2] | 0
                                } while ((y | 0) < (j >> A | 0))
                            }
                            x = x + 1 | 0;
                            if ((x | 0) >= (k >> A | 0)) break a
                        }
                    }
                    qd(f, g, h, j, k);
                    y = n + 10 | 0;
                    a[y >> 0] = 0;
                    if (!(c[f + 2428 >> 2] | 0)) {
                        A = Cb(f, j, k) | 0;
                        if ((A | 0) == 1) {
                            A = 1;
                            z = 22
                        } else z = 19
                    } else {
                        A = 0;
                        z = 19
                    }
                    if ((z | 0) == 19) {
                        B = c[f + 3036 >> 2] | 0;
                        if (B) a[n + 8 >> 0] = Db(f, B) | 0;
                        a[y >> 0] = 1;
                        Mb(f, g, h, 0);
                        sd(f, g, h, j, k, l, m, 0, n, Eb(f) | 0, 0);
                        B = c[n >> 2] | 0;
                        b[n >> 1] = B + (e[x + 31272 >> 1] | 0);
                        b[n + 2 >> 1] = (B >>> 16) + (e[x + 31274 >> 1] | 0);
                        if (A) z = 22
                    }
                    if ((z | 0) == 22) {
                        z = c[f + 3040 >> 2] | 0;
                        if (z) a[n + 9 >> 0] = Db(f, z) | 0;
                        if ((a[f + 3047 >> 0] | 0) == 1 & (A | 0) == 2) c[x + 31272 >> 2] = 0;
                        else Mb(f, g, h, 1);
                        a[y >> 0] = (d[y >> 0] | 0) + 2;
                        sd(f, g, h, j, k, l, m, 0, n, Eb(f) | 0, 1);
                        A = n + 4 | 0;
                        B = c[A >> 2] | 0;
                        b[A >> 1] = B + (e[x + 31272 >> 1] | 0);
                        b[n + 6 >> 1] = (B >>> 16) + (e[x + 31274 >> 1] | 0)
                    }
                    A = c[(c[s >> 2] | 0) + 13084 >> 2] | 0;
                    l = g >> A;
                    m = h >> A;
                    if ((k >> A | 0) > 0) {
                        x = 0;
                        do {
                            if ((j >> A | 0) > 0) {
                                y = ($(x + m | 0, w) | 0) + l | 0;
                                z = 0;
                                do {
                                    A = v + ((y + z | 0) * 12 | 0) | 0;
                                    c[A + 0 >> 2] = c[n + 0 >> 2];
                                    c[A + 4 >> 2] = c[n + 4 >> 2];
                                    c[A + 8 >> 2] = c[n + 8 >> 2];
                                    z = z + 1 | 0;
                                    A = c[(c[s >> 2] | 0) + 13084 >> 2] | 0
                                } while ((z | 0) < (j >> A | 0))
                            }
                            x = x + 1 | 0
                        } while ((x | 0) < (k >> A | 0))
                    }
                } else {
                    if ((c[f + 3080 >> 2] | 0) >>> 0 > 1) x = Ab(f) | 0;
                    else x = 0;
                    y = 1 << l;
                    rd(f, g, h, y, y, l, m, x, n);
                    y = c[(c[s >> 2] | 0) + 13084 >> 2] | 0;
                    l = g >> y;
                    m = h >> y;
                    if ((k >> y | 0) > 0) {
                        x = 0;
                        do {
                            if ((j >> y | 0) > 0) {
                                A = ($(x + m | 0, w) | 0) + l | 0;
                                z = 0;
                                do {
                                    y = v + ((A + z | 0) * 12 | 0) | 0;
                                    c[y + 0 >> 2] = c[n + 0 >> 2];
                                    c[y + 4 >> 2] = c[n + 4 >> 2];
                                    c[y + 8 >> 2] = c[n + 8 >> 2];
                                    z = z + 1 | 0;
                                    y = c[(c[s >> 2] | 0) + 13084 >> 2] | 0
                                } while ((z | 0) < (j >> y | 0))
                            }
                            x = x + 1 | 0
                        } while ((x | 0) < (k >> y | 0))
                    }
                }
            while (0);
            w = a[n + 10 >> 0] | 0;
            if (w & 1) {
                w = c[n + 8 >> 2] | 0;
                v = c[u + (w << 24 >> 24 << 2) >> 2] | 0;
                if (!v) {
                    i = r;
                    return
                } else w = w >>> 16 & 255
            } else v = 0;
            if (w & 2) {
                u = c[u + (a[n + 9 >> 0] << 2) + 196 >> 2] | 0;
                if (!u) {
                    i = r;
                    return
                }
            } else u = 0;
            if (w << 24 >> 24 == 1) {
                u = n + 8 | 0;
                B = a[u >> 0] | 0;
                kc(f, t, c[(c[o >> 2] | 0) + 32 >> 2] | 0, c[v >> 2] | 0, n, g, h, j, k, b[f + (B << 1) + 3104 >> 1] | 0, b[f + (B << 1) + 3296 >> 1] | 0);
                s = c[s >> 2] | 0;
                if (!(c[s + 4 >> 2] | 0)) {
                    i = r;
                    return
                }
                z = c[s + 13172 >> 2] | 0;
                x = g >> z;
                A = c[s + 13184 >> 2] | 0;
                y = h >> A;
                z = j >> z;
                A = k >> A;
                B = c[v >> 2] | 0;
                m = a[u >> 0] | 0;
                lc(f, q, c[(c[o >> 2] | 0) + 36 >> 2] | 0, c[B + 4 >> 2] | 0, c[B + 36 >> 2] | 0, 0, x, y, z, A, n, b[f + (m << 2) + 3136 >> 1] | 0, b[f + (m << 2) + 3328 >> 1] | 0);
                m = c[v >> 2] | 0;
                B = a[u >> 0] | 0;
                lc(f, p, c[(c[o >> 2] | 0) + 40 >> 2] | 0, c[m + 8 >> 2] | 0, c[m + 40 >> 2] | 0, 0, x, y, z, A, n, b[f + (B << 2) + 3138 >> 1] | 0, b[f + (B << 2) + 3330 >> 1] | 0);
                i = r;
                return
            } else if (w << 24 >> 24 == 3) wa();
            else if (w << 24 >> 24 == 2) {
                v = n + 9 | 0;
                B = a[v >> 0] | 0;
                kc(f, t, c[(c[o >> 2] | 0) + 32 >> 2] | 0, c[u >> 2] | 0, n + 4 | 0, g, h, j, k, b[f + (B << 1) + 3264 >> 1] | 0, b[f + (B << 1) + 3392 >> 1] | 0);
                s = c[s >> 2] | 0;
                if (!(c[s + 4 >> 2] | 0)) {
                    i = r;
                    return
                }
                z = c[s + 13172 >> 2] | 0;
                x = g >> z;
                A = c[s + 13184 >> 2] | 0;
                y = h >> A;
                z = j >> z;
                A = k >> A;
                B = c[u >> 2] | 0;
                m = a[v >> 0] | 0;
                lc(f, q, c[(c[o >> 2] | 0) + 36 >> 2] | 0, c[B + 4 >> 2] | 0, c[B + 36 >> 2] | 0, 1, x, y, z, A, n, b[f + (m << 2) + 3200 >> 1] | 0, b[f + (m << 2) + 3424 >> 1] | 0);
                m = c[u >> 2] | 0;
                B = a[v >> 0] | 0;
                lc(f, p, c[(c[o >> 2] | 0) + 40 >> 2] | 0, c[m + 8 >> 2] | 0, c[m + 40 >> 2] | 0, 1, x, y, z, A, n, b[f + (B << 2) + 3202 >> 1] | 0, b[f + (B << 2) + 3426 >> 1] | 0);
                i = r;
                return
            } else {
                i = r;
                return
            }
        }

        function hc(b, d, e, f) {
            b = b | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            var g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0;
            g = i;
            k = c[b + 136 >> 2] | 0;
            h = c[b + 200 >> 2] | 0;
            j = c[h + 13084 >> 2] | 0;
            l = 1 << f >> j;
            h = c[h + 13156 >> 2] | 0;
            f = c[(c[b + 3508 >> 2] | 0) + 16 >> 2] | 0;
            d = d >> j;
            j = e >> j;
            e = (l | 0) == 0 ? 1 : l;
            l = (e | 0) > 0;
            if (l) {
                b = b + 7592 | 0;
                m = 0;
                do {
                    n = ($(m + j | 0, h) | 0) + d | 0;
                    jf((c[b >> 2] | 0) + n | 0, 1, e | 0) | 0;
                    m = m + 1 | 0
                } while ((m | 0) < (e | 0))
            }
            if ((c[k + 31244 >> 2] | 0) != 1 | l ^ 1) {
                i = g;
                return
            } else k = 0;
            do {
                b = ($(k + j | 0, h) | 0) + d | 0;
                l = 0;
                do {
                    a[f + ((b + l | 0) * 12 | 0) + 10 >> 0] = 0;
                    l = l + 1 | 0
                } while ((l | 0) < (e | 0));
                k = k + 1 | 0
            } while ((k | 0) < (e | 0));
            i = g;
            return
        }

        function xd(a, d, e, f, g, h, j, k, l, m) {
            a = a | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            m = m | 0;
            var n = 0,
                o = 0;
            n = i;
            o = c[g + (h * 196 | 0) + (j << 2) + 128 >> 2] | 0;
            if ((o | 0) != (c[k + (l * 196 | 0) + (m << 2) + 128 >> 2] | 0)) {
                b[a >> 1] = 0;
                b[a + 2 >> 1] = 0;
                k = 0;
                i = n;
                return k | 0
            }
            k = c[k + (l * 196 | 0) + (m << 2) + 64 >> 2] | 0;
            m = e - k | 0;
            f = f - (c[g + (h * 196 | 0) + (j << 2) + 64 >> 2] | 0) | 0;
            if ((o | 0) == 0 ? (m | 0) != (f | 0) & (k | 0) != (e | 0) : 0) {
                if ((m + 128 | 0) >>> 0 > 255) m = m >> 31 ^ 127;
                e = m << 24 >> 24;
                if ((f + 128 | 0) >>> 0 > 255) f = f >> 31 ^ 127;
                k = (e | 0) / 2 | 0;
                e = ($(f << 24 >> 24, (((m & 255) << 24 >> 24 > -2 ? k : 0 - k | 0) + 16384 | 0) / (e | 0) | 0) | 0) + 32 >> 6;
                if ((e | 0) < -4096) e = -4096;
                else e = (e | 0) > 4095 ? 4095 : e;
                f = $(b[d >> 1] | 0, e) | 0;
                f = f + 127 + (f >>> 31) | 0;
                o = f >> 8;
                if ((o + 32768 | 0) >>> 0 > 65535) o = f >> 31 ^ 32767;
                b[a >> 1] = o;
                d = $(b[d + 2 >> 1] | 0, e) | 0;
                d = d + 127 + (d >>> 31) | 0;
                e = d >> 8;
                if ((e + 32768 | 0) >>> 0 > 65535) e = d >> 31 ^ 32767;
                b[a + 2 >> 1] = e;
                k = 1;
                i = n;
                return k | 0
            }
            b[a >> 1] = b[d >> 1] | 0;
            b[a + 2 >> 1] = b[d + 2 >> 1] | 0;
            k = 1;
            i = n;
            return k | 0
        }

        function yd(b, d, e, f) {
            b = b | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            var g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0;
            g = i;
            b = (c[b + 136 >> 2] | 0) + 204 | 0;
            j = e + 2188 | 0;
            if (((j | 0) != (d | 0) ? (h = e + 2184 | 0, (c[h >> 2] | 0) != 0) : 0) ? ((_d(b) | 0) & 255) << 24 >> 24 != 0 : 0) {
                do
                    if (f) {
                        f = (ae(b) | 0) + 1 | 0;
                        h = c[h >> 2] | 0;
                        if (f >>> 0 > h >>> 0) {
                            n = -1094995529;
                            i = g;
                            return n | 0
                        } else {
                            h = h - f | 0;
                            break
                        }
                    } else h = ((d - j | 0) / 168 | 0) + -1 | 0;
                while (0);
                f = _d(b) | 0;
                j = (ae(b) | 0) + 1 | 0;
                if ((j | 0) == 0 | j >>> 0 > 32768) {
                    n = -1094995529;
                    i = g;
                    return n | 0
                }
                l = $(1 - (f << 1 & 510) | 0, j) | 0;
                f = e + (h * 168 | 0) + 2192 | 0;
                if ((c[f >> 2] | 0) < 0) {
                    c[d + 4 >> 2] = 0;
                    c[d >> 2] = 0;
                    n = 0;
                    i = g;
                    return n | 0
                } else {
                    k = 0;
                    j = 0;
                    m = 0
                }
                while (1) {
                    n = _d(b) | 0;
                    a[d + j + 136 >> 0] = n;
                    if (!((n & 255 | 0) == 0 ? ((_d(b) | 0) & 255) << 24 >> 24 == 0 : 0)) {
                        if ((k | 0) < (c[f >> 2] | 0)) n = (c[e + (h * 168 | 0) + (k << 2) + 2196 >> 2] | 0) + l | 0;
                        else n = l;
                        c[d + (j << 2) + 8 >> 2] = n;
                        j = j + 1 | 0;
                        m = (n >>> 31) + m | 0
                    }
                    if ((k | 0) < (c[f >> 2] | 0)) k = k + 1 | 0;
                    else break
                }
                b = d + 4 | 0;
                c[b >> 2] = j;
                c[d >> 2] = m;
                if ((j | 0) > 1) {
                    e = 1;
                    do {
                        h = c[d + (e << 2) + 8 >> 2] | 0;
                        f = a[d + e + 136 >> 0] | 0;
                        if ((e | 0) > 0) {
                            k = e;
                            do {
                                m = k;
                                k = k + -1 | 0;
                                l = d + (k << 2) + 8 | 0;
                                j = c[l >> 2] | 0;
                                if ((h | 0) < (j | 0)) {
                                    c[d + (m << 2) + 8 >> 2] = j;
                                    n = d + k + 136 | 0;
                                    a[d + m + 136 >> 0] = a[n >> 0] | 0;
                                    c[l >> 2] = h;
                                    a[n >> 0] = f
                                }
                            } while ((k | 0) > 0);
                            j = c[b >> 2] | 0
                        }
                        e = e + 1 | 0
                    } while ((e | 0) < (j | 0));
                    m = c[d >> 2] | 0
                }
                if (m >>> 0 > 1) b = 0;
                else {
                    n = 0;
                    i = g;
                    return n | 0
                }
                do {
                    m = m + -1 | 0;
                    n = d + (b << 2) + 8 | 0;
                    j = c[n >> 2] | 0;
                    f = d + b + 136 | 0;
                    l = a[f >> 0] | 0;
                    k = d + (m << 2) + 8 | 0;
                    c[n >> 2] = c[k >> 2];
                    n = d + m + 136 | 0;
                    a[f >> 0] = a[n >> 0] | 0;
                    c[k >> 2] = j;
                    a[n >> 0] = l;
                    b = b + 1 | 0
                } while (b >>> 0 < (c[d >> 2] | 0) >>> 1 >>> 0);
                d = 0;
                i = g;
                return d | 0
            }
            c[d >> 2] = ae(b) | 0;
            e = ae(b) | 0;
            h = c[d >> 2] | 0;
            if (h >>> 0 > 15 | e >>> 0 > 15) {
                n = -1094995529;
                i = g;
                return n | 0
            }
            n = h + e | 0;
            c[d + 4 >> 2] = n;
            if (!n) {
                n = 0;
                i = g;
                return n | 0
            }
            if (h) {
                f = 0;
                h = 0;
                do {
                    h = h + -1 - (ae(b) | 0) | 0;
                    c[d + (f << 2) + 8 >> 2] = h;
                    a[d + f + 136 >> 0] = _d(b) | 0;
                    f = f + 1 | 0
                } while (f >>> 0 < (c[d >> 2] | 0) >>> 0)
            }
            if (!e) {
                n = 0;
                i = g;
                return n | 0
            } else {
                f = 0;
                h = 0
            }
            do {
                h = h + 1 + (ae(b) | 0) | 0;
                c[d + ((c[d >> 2] | 0) + f << 2) + 8 >> 2] = h;
                n = (_d(b) | 0) & 255;
                a[d + ((c[d >> 2] | 0) + f) + 136 >> 0] = n;
                f = f + 1 | 0
            } while ((f | 0) != (e | 0));
            d = 0;
            i = g;
            return d | 0
        }

        function zd(b) {
            b = b | 0;
            var e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0;
            f = i;
            i = i + 16 | 0;
            e = f;
            h = c[b + 136 >> 2] | 0;
            g = h + 204 | 0;
            j = se(13196) | 0;
            c[e >> 2] = j;
            if (!j) {
                t = -12;
                i = f;
                return t | 0
            }
            j = c[j + 4 >> 2] | 0;
            l = se(468) | 0;
            if (!l) {
                t = -12;
                i = f;
                return t | 0
            }
            k = c[l + 4 >> 2] | 0;
            c[k + 4 >> 2] = 1;
            n = k + 8 | 0;
            c[n >> 2] = 1;
            a[k >> 0] = 0;
            c[k + 348 >> 2] = 1;
            p = k + 352 | 0;
            m = k + 380 | 0;
            q = k + 408 | 0;
            o = 0;
            do {
                c[p + (o << 2) >> 2] = 1;
                c[m + (o << 2) >> 2] = 0;
                c[q + (o << 2) >> 2] = -1;
                o = o + 1 | 0
            } while ((o | 0) < (c[n >> 2] | 0));
            c[k + 436 >> 2] = 0;
            c[k + 440 >> 2] = 1;
            a[k + 444 >> 0] = 0;
            o = b + 208 | 0;
            ue(o);
            c[o >> 2] = l;
            c[j >> 2] = 0;
            o = j + 72 | 0;
            c[o >> 2] = 1;
            t = Xd(g, 8) | 0;
            p = j + 4 | 0;
            c[p >> 2] = t;
            do
                if ((t | 0) <= 3) {
                    a[j + 8 >> 0] = 0;
                    n = j + 13120 | 0;
                    c[n >> 2] = $d(g, 32) | 0;
                    k = $d(g, 32) | 0;
                    m = j + 13124 | 0;
                    c[m >> 2] = k;
                    k = Md(c[n >> 2] | 0, k, 0, c[b + 4 >> 2] | 0) | 0;
                    if ((k | 0) >= 0) {
                        t = Xd(g, 8) | 0;
                        l = j + 52 | 0;
                        c[l >> 2] = t + 8;
                        if (!t) {
                            p = c[p >> 2] | 0;
                            if (!p) {
                                c[j + 60 >> 2] = 8;
                                p = 8
                            } else if ((p | 0) == 1) {
                                c[j + 60 >> 2] = 0;
                                p = 0
                            } else if ((p | 0) == 2) {
                                c[j + 60 >> 2] = 4;
                                p = 4
                            } else {
                                c[j + 60 >> 2] = 5;
                                p = 5
                            }
                            c[j + 56 >> 2] = 0;
                            p = Ge(p) | 0;
                            if (p) {
                                c[j + 13180 >> 2] = 0;
                                c[j + 13168 >> 2] = 0;
                                t = d[p + 5 >> 0] | 0;
                                c[j + 13172 >> 2] = t;
                                c[j + 13176 >> 2] = t;
                                t = d[p + 6 >> 0] | 0;
                                c[j + 13184 >> 2] = t;
                                c[j + 13188 >> 2] = t;
                                c[j + 64 >> 2] = 8;
                                if ((c[o >> 2] | 0) > 0) {
                                    p = j + 76 | 0;
                                    q = 0;
                                    do {
                                        c[p + (q * 12 | 0) >> 2] = 1;
                                        c[p + (q * 12 | 0) + 4 >> 2] = 0;
                                        c[p + (q * 12 | 0) + 8 >> 2] = -1;
                                        q = q + 1 | 0
                                    } while ((q | 0) < (c[o >> 2] | 0))
                                }
                                s = (ae(g) | 0) + 3 | 0;
                                t = j + 13064 | 0;
                                c[t >> 2] = s;
                                s = 1 << s;
                                r = s + -1 | 0;
                                s = 0 - s | 0;
                                c[n >> 2] = r + (c[n >> 2] | 0) & s;
                                c[m >> 2] = r + (c[m >> 2] | 0) & s;
                                s = j + 13068 | 0;
                                c[s >> 2] = ae(g) | 0;
                                r = j + 13072 | 0;
                                c[r >> 2] = (ae(g) | 0) + 2;
                                o = ae(g) | 0;
                                p = c[r >> 2] | 0;
                                q = j + 13076 | 0;
                                c[q >> 2] = p + o;
                                if (p >>> 0 < (c[t >> 2] | 0) >>> 0) {
                                    u = ae(g) | 0;
                                    o = j + 13092 | 0;
                                    c[o >> 2] = u;
                                    p = j + 13088 | 0;
                                    c[p >> 2] = u;
                                    a[j + 12940 >> 0] = 1;
                                    a[j + 12941 >> 0] = _d(g) | 0;
                                    u = _d(g) | 0;
                                    c[j + 68 >> 2] = u;
                                    if (u) {
                                        u = j + 13044 | 0;
                                        a[u >> 0] = (Xd(g, 4) | 0) + 1;
                                        a[j + 13045 >> 0] = (Xd(g, 4) | 0) + 1;
                                        v = (ae(g) | 0) + 3 | 0;
                                        c[j + 13048 >> 2] = v;
                                        c[j + 13052 >> 2] = v + (ae(g) | 0);
                                        if ((d[u >> 0] | 0 | 0) > (c[l >> 2] | 0)) {
                                            k = -1094995529;
                                            break
                                        }
                                        a[j + 13056 >> 0] = _d(g) | 0
                                    }
                                    c[j + 2184 >> 2] = 0;
                                    a[j + 12942 >> 0] = 0;
                                    a[j + 13060 >> 0] = 1;
                                    a[j + 13061 >> 0] = _d(g) | 0;
                                    c[j + 160 >> 2] = 0;
                                    c[j + 164 >> 2] = 1;
                                    if ((_d(g) | 0) != 0 ? (v = _d(g) | 0, Zd(g, 7), (v | 0) != 0) : 0) {
                                        c[j + 13096 >> 2] = _d(g) | 0;
                                        c[j + 13100 >> 2] = _d(g) | 0;
                                        c[j + 13104 >> 2] = _d(g) | 0;
                                        c[j + 13108 >> 2] = _d(g) | 0;
                                        _d(g) | 0;
                                        c[j + 13112 >> 2] = _d(g) | 0;
                                        _d(g) | 0;
                                        c[j + 13116 >> 2] = _d(g) | 0;
                                        _d(g) | 0
                                    }
                                    g = c[n >> 2] | 0;
                                    c[j + 12 >> 2] = g;
                                    n = c[m >> 2] | 0;
                                    c[j + 16 >> 2] = n;
                                    t = c[t >> 2] | 0;
                                    v = (c[s >> 2] | 0) + t | 0;
                                    c[j + 13080 >> 2] = v;
                                    s = t + -1 | 0;
                                    c[j + 13084 >> 2] = s;
                                    m = 1 << v;
                                    u = g + -1 + m >> v;
                                    c[j + 13128 >> 2] = u;
                                    m = n + -1 + m >> v;
                                    c[j + 13132 >> 2] = m;
                                    c[j + 13136 >> 2] = $(m, u) | 0;
                                    c[j + 13140 >> 2] = g >> t;
                                    c[j + 13144 >> 2] = n >> t;
                                    u = c[r >> 2] | 0;
                                    c[j + 13148 >> 2] = g >> u;
                                    c[j + 13152 >> 2] = n >> u;
                                    c[j + 13156 >> 2] = g >> s;
                                    c[j + 13160 >> 2] = n >> s;
                                    u = v - u | 0;
                                    c[j + 13164 >> 2] = (1 << u) + -1;
                                    c[j + 13192 >> 2] = ((c[l >> 2] | 0) * 6 | 0) + -48;
                                    t = (1 << t) + -1 | 0;
                                    if ((((((t & g | 0) == 0 ? !((n & t | 0) != 0 | v >>> 0 > 6) : 0) ? (c[p >> 2] | 0) >>> 0 <= u >>> 0 : 0) ? (c[o >> 2] | 0) >>> 0 <= u >>> 0 : 0) ? (c[q >> 2] | 0) >>> 0 <= (v >>> 0 > 5 ? 5 : v) >>> 0 : 0) ? ((c[h + 216 >> 2] | 0) - (c[h + 212 >> 2] | 0) | 0) >= 0 : 0) {
                                        g = b + 272 | 0;
                                        h = c[g >> 2] | 0;
                                        if ((h | 0) != 0 ? (v = c[e >> 2] | 0, (cf(c[h + 4 >> 2] | 0, c[v + 4 >> 2] | 0, c[v + 8 >> 2] | 0) | 0) == 0) : 0) {
                                            ue(e);
                                            v = 0;
                                            i = f;
                                            return v | 0
                                        } else h = 0;
                                        do {
                                            j = b + (h << 2) + 400 | 0;
                                            k = c[j >> 2] | 0;
                                            do
                                                if (k) {
                                                    if (c[c[k + 4 >> 2] >> 2] | 0) break;
                                                    ue(j)
                                                }
                                            while (0);
                                            h = h + 1 | 0
                                        } while ((h | 0) != 256);
                                        h = c[g >> 2] | 0;
                                        do
                                            if (h) {
                                                j = b + 200 | 0;
                                                if ((c[j >> 2] | 0) != (c[h + 4 >> 2] | 0)) break;
                                                u = b + 1424 | 0;
                                                ue(u);
                                                v = te(c[g >> 2] | 0) | 0;
                                                c[u >> 2] = v;
                                                if (v) break;
                                                c[j >> 2] = 0
                                            }
                                        while (0);
                                        ue(g);
                                        c[g >> 2] = c[e >> 2];
                                        v = 0;
                                        i = f;
                                        return v | 0
                                    }
                                } else k = -1094995529
                            } else k = -22
                        } else k = -1094995529
                    }
                } else k = -1094995529;
            while (0);
            ue(e);
            v = k;
            i = f;
            return v | 0
        }

        function Ad(b) {
            b = b | 0;
            var e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                E = 0,
                F = 0,
                G = 0,
                H = 0,
                I = 0;
            f = i;
            i = i + 16 | 0;
            e = f + 4 | 0;
            j = f;
            l = b + 136 | 0;
            g = c[l >> 2] | 0;
            n = g + 204 | 0;
            h = le(1692) | 0;
            c[j >> 2] = h;
            if (!h) {
                I = -12;
                i = f;
                return I | 0
            }
            I = pe(h, 1692, 6, 0, 0) | 0;
            c[e >> 2] = I;
            if (!I) {
                ie(j);
                I = -12;
                i = f;
                return I | 0
            }
            a[(c[j >> 2] | 0) + 53 >> 0] = 1;
            h = c[j >> 2] | 0;
            c[h + 44 >> 2] = 1;
            c[h + 48 >> 2] = 1;
            a[h + 52 >> 0] = 1;
            a[(c[j >> 2] | 0) + 57 >> 0] = 0;
            h = c[j >> 2] | 0;
            c[h + 60 >> 2] = 0;
            c[h + 64 >> 2] = 0;
            a[h + 1629 >> 0] = 2;
            h = ae(n) | 0;
            a: do
                if ((h >>> 0 <= 255 ? (k = ae(n) | 0, c[c[j >> 2] >> 2] = k, k >>> 0 <= 31) : 0) ? (m = c[b + (k << 2) + 272 >> 2] | 0, (m | 0) != 0) : 0) {
                    k = c[m + 4 >> 2] | 0;
                    I = (_d(n) | 0) & 255;
                    a[(c[j >> 2] | 0) + 41 >> 0] = I;
                    I = (_d(n) | 0) & 255;
                    a[(c[j >> 2] | 0) + 39 >> 0] = I;
                    I = Xd(n, 3) | 0;
                    c[(c[j >> 2] | 0) + 1624 >> 2] = I;
                    I = (_d(n) | 0) & 255;
                    a[(c[j >> 2] | 0) + 4 >> 0] = I;
                    I = (_d(n) | 0) & 255;
                    a[(c[j >> 2] | 0) + 5 >> 0] = I;
                    I = (ae(n) | 0) + 1 | 0;
                    c[(c[j >> 2] | 0) + 8 >> 2] = I;
                    I = (ae(n) | 0) + 1 | 0;
                    c[(c[j >> 2] | 0) + 12 >> 2] = I;
                    I = be(n) | 0;
                    c[(c[j >> 2] | 0) + 16 >> 2] = I;
                    I = (_d(n) | 0) & 255;
                    a[(c[j >> 2] | 0) + 20 >> 0] = I;
                    I = (_d(n) | 0) & 255;
                    a[(c[j >> 2] | 0) + 21 >> 0] = I;
                    I = (_d(n) | 0) & 255;
                    a[(c[j >> 2] | 0) + 22 >> 0] = I;
                    I = c[j >> 2] | 0;
                    c[I + 24 >> 2] = 0;
                    if (a[I + 22 >> 0] | 0) {
                        I = ae(n) | 0;
                        c[(c[j >> 2] | 0) + 24 >> 2] = I
                    }
                    I = be(n) | 0;
                    c[(c[j >> 2] | 0) + 28 >> 2] = I;
                    if ((I + 12 | 0) >>> 0 <= 24 ? (I = be(n) | 0, c[(c[j >> 2] | 0) + 32 >> 2] = I, (I + 12 | 0) >>> 0 <= 24) : 0) {
                        I = (_d(n) | 0) & 255;
                        a[(c[j >> 2] | 0) + 36 >> 0] = I;
                        I = (_d(n) | 0) & 255;
                        a[(c[j >> 2] | 0) + 37 >> 0] = I;
                        I = (_d(n) | 0) & 255;
                        a[(c[j >> 2] | 0) + 38 >> 0] = I;
                        I = (_d(n) | 0) & 255;
                        a[(c[j >> 2] | 0) + 40 >> 0] = I;
                        I = (_d(n) | 0) & 255;
                        a[(c[j >> 2] | 0) + 42 >> 0] = I;
                        I = (_d(n) | 0) & 255;
                        a[(c[j >> 2] | 0) + 43 >> 0] = I;
                        if (a[(c[j >> 2] | 0) + 42 >> 0] | 0) {
                            m = (ae(n) | 0) + 1 | 0;
                            c[(c[j >> 2] | 0) + 44 >> 2] = m;
                            m = (ae(n) | 0) + 1 | 0;
                            o = c[j >> 2] | 0;
                            c[o + 48 >> 2] = m;
                            o = c[o + 44 >> 2] | 0;
                            if (!o) {
                                b = -1094995529;
                                break
                            }
                            if ((m | 0) == 0 ? 1 : (o | 0) >= (c[k + 13120 >> 2] | 0)) {
                                b = -1094995529;
                                break
                            }
                            if ((m | 0) >= (c[k + 13124 >> 2] | 0)) {
                                b = -1094995529;
                                break
                            }
                            m = ne(o, 4) | 0;
                            c[(c[j >> 2] | 0) + 1648 >> 2] = m;
                            m = ne(c[(c[j >> 2] | 0) + 48 >> 2] | 0, 4) | 0;
                            c[(c[j >> 2] | 0) + 1652 >> 2] = m;
                            m = c[j >> 2] | 0;
                            if (!(c[m + 1648 >> 2] | 0)) {
                                b = -12;
                                break
                            }
                            if (!(c[m + 1652 >> 2] | 0)) {
                                b = -12;
                                break
                            }
                            p = (_d(n) | 0) & 255;
                            a[(c[j >> 2] | 0) + 52 >> 0] = p;
                            p = c[j >> 2] | 0;
                            if (!(a[p + 52 >> 0] | 0)) {
                                q = (c[p + 44 >> 2] | 0) + -1 | 0;
                                if ((q | 0) > 0) {
                                    o = 0;
                                    m = 0;
                                    r = 0;
                                    do {
                                        q = (ae(n) | 0) + 1 | 0;
                                        p = c[j >> 2] | 0;
                                        c[(c[p + 1648 >> 2] | 0) + (r << 2) >> 2] = q;
                                        o = gf(q | 0, 0, o | 0, m | 0) | 0;
                                        m = D;
                                        r = r + 1 | 0;
                                        q = (c[p + 44 >> 2] | 0) + -1 | 0
                                    } while ((r | 0) < (q | 0))
                                } else {
                                    m = 0;
                                    o = 0
                                }
                                r = c[k + 13128 >> 2] | 0;
                                s = ((r | 0) < 0) << 31 >> 31;
                                if (!(m >>> 0 < s >>> 0 | (m | 0) == (s | 0) & o >>> 0 < r >>> 0)) {
                                    b = -1094995529;
                                    break
                                }
                                I = ff(r | 0, s | 0, o | 0, m | 0) | 0;
                                c[(c[p + 1648 >> 2] | 0) + (q << 2) >> 2] = I;
                                q = (c[p + 48 >> 2] | 0) + -1 | 0;
                                if ((q | 0) > 0) {
                                    p = 0;
                                    o = 0;
                                    r = 0;
                                    do {
                                        q = (ae(n) | 0) + 1 | 0;
                                        m = c[j >> 2] | 0;
                                        c[(c[m + 1652 >> 2] | 0) + (r << 2) >> 2] = q;
                                        p = gf(q | 0, 0, p | 0, o | 0) | 0;
                                        o = D;
                                        r = r + 1 | 0;
                                        q = (c[m + 48 >> 2] | 0) + -1 | 0
                                    } while ((r | 0) < (q | 0))
                                } else {
                                    m = p;
                                    o = 0;
                                    p = 0
                                }
                                r = c[k + 13132 >> 2] | 0;
                                s = ((r | 0) < 0) << 31 >> 31;
                                if (!(o >>> 0 < s >>> 0 | (o | 0) == (s | 0) & p >>> 0 < r >>> 0)) {
                                    b = -1094995529;
                                    break
                                }
                                I = ff(r | 0, s | 0, p | 0, o | 0) | 0;
                                c[(c[m + 1652 >> 2] | 0) + (q << 2) >> 2] = I
                            }
                            I = (_d(n) | 0) & 255;
                            a[(c[j >> 2] | 0) + 53 >> 0] = I
                        }
                        I = (_d(n) | 0) & 255;
                        a[(c[j >> 2] | 0) + 54 >> 0] = I;
                        I = (_d(n) | 0) & 255;
                        a[(c[j >> 2] | 0) + 55 >> 0] = I;
                        if ((a[(c[j >> 2] | 0) + 55 >> 0] | 0) != 0 ? (I = (_d(n) | 0) & 255, a[(c[j >> 2] | 0) + 56 >> 0] = I, I = (_d(n) | 0) & 255, a[(c[j >> 2] | 0) + 57 >> 0] = I, (a[(c[j >> 2] | 0) + 57 >> 0] | 0) == 0) : 0) {
                            m = (be(n) | 0) << 1;
                            c[(c[j >> 2] | 0) + 60 >> 2] = m;
                            m = (be(n) | 0) << 1;
                            I = c[j >> 2] | 0;
                            c[I + 64 >> 2] = m;
                            if (((c[I + 60 >> 2] | 0) + 13 | 0) >>> 0 > 26) {
                                b = -1094995529;
                                break
                            }
                            if ((m + 13 | 0) >>> 0 > 26) {
                                b = -1094995529;
                                break
                            }
                        }
                        p = (_d(n) | 0) & 255;
                        a[(c[j >> 2] | 0) + 68 >> 0] = p;
                        p = c[j >> 2] | 0;
                        if (a[p + 68 >> 0] | 0) {
                            q = 0;
                            do {
                                o = p + (q << 6) + 69 | 0;
                                m = o + 16 | 0;
                                do {
                                    a[o >> 0] = 16;
                                    o = o + 1 | 0
                                } while ((o | 0) < (m | 0));
                                a[p + q + 1605 >> 0] = 16;
                                a[p + q + 1611 >> 0] = 16;
                                q = q + 1 | 0
                            } while ((q | 0) != 6);
                            o = p + 453 | 0;
                            q = 2936;
                            m = o + 64 | 0;
                            do {
                                a[o >> 0] = a[q >> 0] | 0;
                                o = o + 1 | 0;
                                q = q + 1 | 0
                            } while ((o | 0) < (m | 0));
                            o = p + 517 | 0;
                            q = 2936;
                            m = o + 64 | 0;
                            do {
                                a[o >> 0] = a[q >> 0] | 0;
                                o = o + 1 | 0;
                                q = q + 1 | 0
                            } while ((o | 0) < (m | 0));
                            o = p + 581 | 0;
                            q = 2936;
                            m = o + 64 | 0;
                            do {
                                a[o >> 0] = a[q >> 0] | 0;
                                o = o + 1 | 0;
                                q = q + 1 | 0
                            } while ((o | 0) < (m | 0));
                            o = p + 645 | 0;
                            q = 3e3;
                            m = o + 64 | 0;
                            do {
                                a[o >> 0] = a[q >> 0] | 0;
                                o = o + 1 | 0;
                                q = q + 1 | 0
                            } while ((o | 0) < (m | 0));
                            o = p + 709 | 0;
                            q = 3e3;
                            m = o + 64 | 0;
                            do {
                                a[o >> 0] = a[q >> 0] | 0;
                                o = o + 1 | 0;
                                q = q + 1 | 0
                            } while ((o | 0) < (m | 0));
                            o = p + 773 | 0;
                            q = 3e3;
                            m = o + 64 | 0;
                            do {
                                a[o >> 0] = a[q >> 0] | 0;
                                o = o + 1 | 0;
                                q = q + 1 | 0
                            } while ((o | 0) < (m | 0));
                            o = p + 837 | 0;
                            q = 2936;
                            m = o + 64 | 0;
                            do {
                                a[o >> 0] = a[q >> 0] | 0;
                                o = o + 1 | 0;
                                q = q + 1 | 0
                            } while ((o | 0) < (m | 0));
                            o = p + 901 | 0;
                            q = 2936;
                            m = o + 64 | 0;
                            do {
                                a[o >> 0] = a[q >> 0] | 0;
                                o = o + 1 | 0;
                                q = q + 1 | 0
                            } while ((o | 0) < (m | 0));
                            o = p + 965 | 0;
                            q = 2936;
                            m = o + 64 | 0;
                            do {
                                a[o >> 0] = a[q >> 0] | 0;
                                o = o + 1 | 0;
                                q = q + 1 | 0
                            } while ((o | 0) < (m | 0));
                            o = p + 1029 | 0;
                            q = 3e3;
                            m = o + 64 | 0;
                            do {
                                a[o >> 0] = a[q >> 0] | 0;
                                o = o + 1 | 0;
                                q = q + 1 | 0
                            } while ((o | 0) < (m | 0));
                            o = p + 1093 | 0;
                            q = 3e3;
                            m = o + 64 | 0;
                            do {
                                a[o >> 0] = a[q >> 0] | 0;
                                o = o + 1 | 0;
                                q = q + 1 | 0
                            } while ((o | 0) < (m | 0));
                            o = p + 1157 | 0;
                            q = 3e3;
                            m = o + 64 | 0;
                            do {
                                a[o >> 0] = a[q >> 0] | 0;
                                o = o + 1 | 0;
                                q = q + 1 | 0
                            } while ((o | 0) < (m | 0));
                            o = p + 1221 | 0;
                            q = 2936;
                            m = o + 64 | 0;
                            do {
                                a[o >> 0] = a[q >> 0] | 0;
                                o = o + 1 | 0;
                                q = q + 1 | 0
                            } while ((o | 0) < (m | 0));
                            o = p + 1285 | 0;
                            q = 2936;
                            m = o + 64 | 0;
                            do {
                                a[o >> 0] = a[q >> 0] | 0;
                                o = o + 1 | 0;
                                q = q + 1 | 0
                            } while ((o | 0) < (m | 0));
                            o = p + 1349 | 0;
                            q = 2936;
                            m = o + 64 | 0;
                            do {
                                a[o >> 0] = a[q >> 0] | 0;
                                o = o + 1 | 0;
                                q = q + 1 | 0
                            } while ((o | 0) < (m | 0));
                            o = p + 1413 | 0;
                            q = 3e3;
                            m = o + 64 | 0;
                            do {
                                a[o >> 0] = a[q >> 0] | 0;
                                o = o + 1 | 0;
                                q = q + 1 | 0
                            } while ((o | 0) < (m | 0));
                            o = p + 1477 | 0;
                            q = 3e3;
                            m = o + 64 | 0;
                            do {
                                a[o >> 0] = a[q >> 0] | 0;
                                o = o + 1 | 0;
                                q = q + 1 | 0
                            } while ((o | 0) < (m | 0));
                            o = p + 1541 | 0;
                            q = 3e3;
                            m = o + 64 | 0;
                            do {
                                a[o >> 0] = a[q >> 0] | 0;
                                o = o + 1 | 0;
                                q = q + 1 | 0
                            } while ((o | 0) < (m | 0));
                            m = c[j >> 2] | 0;
                            v = (c[l >> 2] | 0) + 204 | 0;
                            w = 0;
                            do {
                                p = (w | 0) > 0 ? 64 : 16;
                                q = (w | 0) > 1;
                                o = w + -2 | 0;
                                x = (w | 0) == 3 ? 3 : 1;
                                r = 1 << (w << 1) + 4;
                                t = (r | 0) > 0;
                                s = (w | 0) == 0;
                                r = (r | 0) < 64 ? r : 64;
                                u = 0;
                                do {
                                    if (!(((_d(v) | 0) & 255) << 24 >> 24)) {
                                        y = ae(v) | 0;
                                        if (y) {
                                            if (u >>> 0 < y >>> 0) {
                                                b = -1094995529;
                                                break a
                                            }
                                            y = u - y | 0;
                                            mf(m + (w * 384 | 0) + (u << 6) + 69 | 0, m + (w * 384 | 0) + (y << 6) + 69 | 0, p | 0) | 0;
                                            if (q) a[m + (o * 6 | 0) + u + 1605 >> 0] = a[m + (o * 6 | 0) + y + 1605 >> 0] | 0
                                        }
                                    } else {
                                        if (q) {
                                            z = (be(v) | 0) + 8 | 0;
                                            a[m + (o * 6 | 0) + u + 1605 >> 0] = z
                                        } else z = 8;
                                        if (t) {
                                            y = 0;
                                            do {
                                                if (s) A = (d[24 + y >> 0] << 2) + (d[8 + y >> 0] | 0) | 0;
                                                else A = (d[104 + y >> 0] << 3) + (d[40 + y >> 0] | 0) | 0;
                                                z = (z + 256 + (be(v) | 0) | 0) % 256 | 0;
                                                a[m + (w * 384 | 0) + (u << 6) + A + 69 >> 0] = z;
                                                y = y + 1 | 0
                                            } while ((y | 0) != (r | 0))
                                        }
                                    }
                                    u = u + x | 0
                                } while ((u | 0) < 6);
                                w = w + 1 | 0
                            } while ((w | 0) < 4);
                            if ((c[k + 4 >> 2] | 0) == 3) {
                                o = 0;
                                do {
                                    a[m + o + 1285 >> 0] = a[m + o + 901 >> 0] | 0;
                                    a[m + o + 1349 >> 0] = a[m + o + 965 >> 0] | 0;
                                    a[m + o + 1477 >> 0] = a[m + o + 1093 >> 0] | 0;
                                    a[m + o + 1541 >> 0] = a[m + o + 1157 >> 0] | 0;
                                    o = o + 1 | 0
                                } while ((o | 0) != 64);
                                a[m + 1612 >> 0] = a[m + 1606 >> 0] | 0;
                                a[m + 1613 >> 0] = a[m + 1607 >> 0] | 0;
                                a[m + 1615 >> 0] = a[m + 1609 >> 0] | 0;
                                a[m + 1616 >> 0] = a[m + 1610 >> 0] | 0
                            }
                        }
                        I = (_d(n) | 0) & 255;
                        a[(c[j >> 2] | 0) + 1617 >> 0] = I;
                        I = (ae(n) | 0) + 2 | 0;
                        c[(c[j >> 2] | 0) + 1620 >> 2] = I;
                        m = k + 13080 | 0;
                        if (I >>> 0 <= (c[m >> 2] | 0) >>> 0) {
                            I = (_d(n) | 0) & 255;
                            a[(c[j >> 2] | 0) + 1628 >> 0] = I;
                            do
                                if ((_d(n) | 0) != 0 ? (I = _d(n) | 0, Xd(n, 7) | 0, (I | 0) != 0) : 0) {
                                    n = c[j >> 2] | 0;
                                    p = (c[l >> 2] | 0) + 204 | 0;
                                    if (a[n + 21 >> 0] | 0) a[n + 1629 >> 0] = (ae(p) | 0) + 2;
                                    a[n + 1630 >> 0] = _d(p) | 0;
                                    I = (_d(p) | 0) & 255;
                                    a[n + 1631 >> 0] = I;
                                    if (I << 24 >> 24) {
                                        a[n + 1632 >> 0] = ae(p) | 0;
                                        I = ae(p) | 0;
                                        o = n + 1633 | 0;
                                        a[o >> 0] = I;
                                        if ((I & 255) >>> 0 < 5) l = 0;
                                        else break;
                                        while (1) {
                                            a[n + l + 1634 >> 0] = be(p) | 0;
                                            a[n + l + 1639 >> 0] = be(p) | 0;
                                            if ((l | 0) < (d[o >> 0] | 0)) l = l + 1 | 0;
                                            else break
                                        }
                                    }
                                    a[n + 1644 >> 0] = ae(p) | 0;
                                    a[n + 1645 >> 0] = ae(p) | 0
                                }
                            while (0);
                            l = ne((c[(c[j >> 2] | 0) + 44 >> 2] | 0) + 1 | 0, 4) | 0;
                            c[(c[j >> 2] | 0) + 1656 >> 2] = l;
                            l = ne((c[(c[j >> 2] | 0) + 48 >> 2] | 0) + 1 | 0, 4) | 0;
                            c[(c[j >> 2] | 0) + 1660 >> 2] = l;
                            l = k + 13128 | 0;
                            o = ne(c[l >> 2] | 0, 4) | 0;
                            c[(c[j >> 2] | 0) + 1664 >> 2] = o;
                            o = c[j >> 2] | 0;
                            n = c[o + 1656 >> 2] | 0;
                            if (((n | 0) != 0 ? (c[o + 1660 >> 2] | 0) != 0 : 0) ? (c[o + 1664 >> 2] | 0) != 0 : 0) {
                                if (a[o + 52 >> 0] | 0) {
                                    p = c[o + 1648 >> 2] | 0;
                                    if (!p) {
                                        o = ne(c[o + 44 >> 2] | 0, 4) | 0;
                                        c[(c[j >> 2] | 0) + 1648 >> 2] = o;
                                        o = ne(c[(c[j >> 2] | 0) + 48 >> 2] | 0, 4) | 0;
                                        c[(c[j >> 2] | 0) + 1652 >> 2] = o;
                                        o = c[j >> 2] | 0;
                                        p = c[o + 1648 >> 2] | 0;
                                        if (!p) {
                                            b = -12;
                                            break
                                        }
                                    }
                                    n = c[o + 1652 >> 2] | 0;
                                    if (!n) {
                                        b = -12;
                                        break
                                    }
                                    q = o + 44 | 0;
                                    s = c[q >> 2] | 0;
                                    if ((s | 0) > 0) {
                                        r = 0;
                                        do {
                                            I = r;
                                            r = r + 1 | 0;
                                            H = c[l >> 2] | 0;
                                            c[p + (I << 2) >> 2] = (($(H, r) | 0) / (s | 0) | 0) - (($(H, I) | 0) / (s | 0) | 0);
                                            s = c[q >> 2] | 0
                                        } while ((r | 0) < (s | 0))
                                    }
                                    q = o + 48 | 0;
                                    s = c[q >> 2] | 0;
                                    if ((s | 0) > 0) {
                                        p = k + 13132 | 0;
                                        r = 0;
                                        do {
                                            I = r;
                                            r = r + 1 | 0;
                                            H = c[p >> 2] | 0;
                                            c[n + (I << 2) >> 2] = (($(H, r) | 0) / (s | 0) | 0) - (($(H, I) | 0) / (s | 0) | 0);
                                            s = c[q >> 2] | 0
                                        } while ((r | 0) < (s | 0))
                                    }
                                    n = c[o + 1656 >> 2] | 0
                                }
                                c[n >> 2] = 0;
                                q = o + 44 | 0;
                                if ((c[q >> 2] | 0) > 0) {
                                    p = c[o + 1648 >> 2] | 0;
                                    r = 0;
                                    s = 0;
                                    do {
                                        r = (c[p + (s << 2) >> 2] | 0) + r | 0;
                                        s = s + 1 | 0;
                                        c[n + (s << 2) >> 2] = r
                                    } while ((s | 0) < (c[q >> 2] | 0))
                                }
                                s = c[o + 1660 >> 2] | 0;
                                c[s >> 2] = 0;
                                r = o + 48 | 0;
                                if ((c[r >> 2] | 0) > 0) {
                                    q = c[o + 1652 >> 2] | 0;
                                    t = 0;
                                    p = 0;
                                    do {
                                        t = (c[q + (p << 2) >> 2] | 0) + t | 0;
                                        p = p + 1 | 0;
                                        c[s + (p << 2) >> 2] = t
                                    } while ((p | 0) < (c[r >> 2] | 0))
                                }
                                r = c[l >> 2] | 0;
                                if ((r | 0) > 0) {
                                    o = c[o + 1664 >> 2] | 0;
                                    p = 0;
                                    q = 0;
                                    do {
                                        q = (p >>> 0 > (c[n + (q << 2) >> 2] | 0) >>> 0 & 1) + q | 0;
                                        c[o + (p << 2) >> 2] = q;
                                        p = p + 1 | 0;
                                        r = c[l >> 2] | 0
                                    } while ((p | 0) < (r | 0))
                                }
                                x = $(c[k + 13132 >> 2] | 0, r) | 0;
                                n = ne(x, 4) | 0;
                                c[(c[j >> 2] | 0) + 1668 >> 2] = n;
                                n = ne(x, 4) | 0;
                                c[(c[j >> 2] | 0) + 1672 >> 2] = n;
                                n = ne(x, 4) | 0;
                                c[(c[j >> 2] | 0) + 1676 >> 2] = n;
                                n = k + 13164 | 0;
                                q = (c[n >> 2] | 0) + 2 | 0;
                                q = ne($(q, q) | 0, 4) | 0;
                                c[(c[j >> 2] | 0) + 1688 >> 2] = q;
                                q = c[j >> 2] | 0;
                                p = c[q + 1668 >> 2] | 0;
                                if (!p) {
                                    b = -12;
                                    break
                                }
                                w = c[q + 1672 >> 2] | 0;
                                if (!w) {
                                    b = -12;
                                    break
                                }
                                o = c[q + 1676 >> 2] | 0;
                                if (!o) {
                                    b = -12;
                                    break
                                }
                                if (!(c[q + 1688 >> 2] | 0)) {
                                    b = -12;
                                    break
                                }
                                if ((x | 0) > 0) {
                                    B = q + 44 | 0;
                                    r = q + 48 | 0;
                                    s = c[q + 1660 >> 2] | 0;
                                    v = c[q + 1648 >> 2] | 0;
                                    u = c[q + 1656 >> 2] | 0;
                                    t = q + 1652 | 0;
                                    A = 0;
                                    do {
                                        C = c[l >> 2] | 0;
                                        y = (A | 0) % (C | 0) | 0;
                                        z = (A | 0) / (C | 0) | 0;
                                        G = c[B >> 2] | 0;
                                        E = 0;
                                        while (1) {
                                            if ((E | 0) >= (G | 0)) {
                                                E = 0;
                                                break
                                            }
                                            F = E + 1 | 0;
                                            if (y >>> 0 < (c[u + (F << 2) >> 2] | 0) >>> 0) break;
                                            else E = F
                                        }
                                        H = c[r >> 2] | 0;
                                        F = 0;
                                        while (1) {
                                            if ((F | 0) >= (H | 0)) {
                                                F = 0;
                                                break
                                            }
                                            G = F + 1 | 0;
                                            if (z >>> 0 < (c[s + (G << 2) >> 2] | 0) >>> 0) break;
                                            else F = G
                                        }
                                        if ((E | 0) > 0) {
                                            G = c[(c[t >> 2] | 0) + (F << 2) >> 2] | 0;
                                            H = 0;
                                            I = 0;
                                            do {
                                                I = ($(c[v + (H << 2) >> 2] | 0, G) | 0) + I | 0;
                                                H = H + 1 | 0
                                            } while ((H | 0) != (E | 0))
                                        } else I = 0;
                                        if ((F | 0) > 0) {
                                            G = c[t >> 2] | 0;
                                            H = 0;
                                            do {
                                                I = ($(c[G + (H << 2) >> 2] | 0, C) | 0) + I | 0;
                                                H = H + 1 | 0
                                            } while ((H | 0) != (F | 0))
                                        }
                                        H = $(c[v + (E << 2) >> 2] | 0, z - (c[s + (F << 2) >> 2] | 0) | 0) | 0;
                                        I = I + y + H - (c[u + (E << 2) >> 2] | 0) | 0;
                                        c[p + (A << 2) >> 2] = I;
                                        c[w + (I << 2) >> 2] = A;
                                        A = A + 1 | 0
                                    } while ((A | 0) != (x | 0))
                                } else r = q + 48 | 0;
                                x = c[r >> 2] | 0;
                                if ((x | 0) > 0) {
                                    s = q + 44 | 0;
                                    t = q + 1660 | 0;
                                    q = q + 1656 | 0;
                                    z = c[s >> 2] | 0;
                                    u = 0;
                                    w = 0;
                                    while (1) {
                                        v = u;
                                        u = u + 1 | 0;
                                        if ((z | 0) > 0) {
                                            x = c[t >> 2] | 0;
                                            y = x + (u << 2) | 0;
                                            G = c[y >> 2] | 0;
                                            B = z;
                                            z = 0;
                                            do {
                                                E = c[x + (v << 2) >> 2] | 0;
                                                A = z;
                                                z = z + 1 | 0;
                                                if (E >>> 0 < G >>> 0) {
                                                    B = c[q >> 2] | 0;
                                                    C = B + (z << 2) | 0;
                                                    F = c[C >> 2] | 0;
                                                    do {
                                                        H = c[B + (A << 2) >> 2] | 0;
                                                        if (H >>> 0 < F >>> 0) {
                                                            do {
                                                                c[o + (c[p + (($(c[l >> 2] | 0, E) | 0) + H << 2) >> 2] << 2) >> 2] = w;
                                                                H = H + 1 | 0;
                                                                F = c[C >> 2] | 0
                                                            } while (H >>> 0 < F >>> 0);
                                                            G = c[y >> 2] | 0
                                                        }
                                                        E = E + 1 | 0
                                                    } while (E >>> 0 < G >>> 0);
                                                    B = c[s >> 2] | 0
                                                }
                                                w = w + 1 | 0
                                            } while ((z | 0) < (B | 0));
                                            v = c[r >> 2] | 0;
                                            z = B
                                        } else v = x;
                                        if ((u | 0) >= (v | 0)) break;
                                        else x = v
                                    }
                                } else w = 0;
                                o = ne(w, 4) | 0;
                                c[(c[j >> 2] | 0) + 1680 >> 2] = o;
                                o = c[j >> 2] | 0;
                                p = c[o + 1680 >> 2] | 0;
                                if (!p) {
                                    b = -12;
                                    break
                                }
                                r = o + 48 | 0;
                                u = c[r >> 2] | 0;
                                if ((u | 0) > 0) {
                                    q = o + 44 | 0;
                                    t = c[q >> 2] | 0;
                                    s = 0;
                                    do {
                                        if ((t | 0) > 0) {
                                            u = c[o + 1660 >> 2] | 0;
                                            v = c[o + 1656 >> 2] | 0;
                                            w = 0;
                                            do {
                                                I = $(c[l >> 2] | 0, c[u + (s << 2) >> 2] | 0) | 0;
                                                c[p + (($(t, s) | 0) + w << 2) >> 2] = (c[v + (w << 2) >> 2] | 0) + I;
                                                w = w + 1 | 0;
                                                t = c[q >> 2] | 0
                                            } while ((w | 0) < (t | 0));
                                            u = c[r >> 2] | 0
                                        }
                                        s = s + 1 | 0
                                    } while ((s | 0) < (u | 0))
                                }
                                k = (c[m >> 2] | 0) - (c[k + 13072 >> 2] | 0) | 0;
                                v = c[n >> 2] | 0;
                                c[o + 1684 >> 2] = (c[o + 1688 >> 2] | 0) + (v + 3 << 2);
                                p = v + 2 | 0;
                                if ((p | 0) > 0) {
                                    m = c[(c[j >> 2] | 0) + 1688 >> 2] | 0;
                                    o = 0;
                                    do {
                                        c[m + (($(p, o) | 0) << 2) >> 2] = -1;
                                        c[m + (o << 2) >> 2] = -1;
                                        o = o + 1 | 0;
                                        v = c[n >> 2] | 0;
                                        p = v + 2 | 0
                                    } while ((o | 0) < (p | 0))
                                }
                                if ((v | 0) > -1) {
                                    m = c[j >> 2] | 0;
                                    j = m + 1668 | 0;
                                    p = k << 1;
                                    o = (k | 0) > 0;
                                    m = m + 1684 | 0;
                                    q = 0;
                                    while (1) {
                                        if ((v | 0) > -1) {
                                            r = q >> k;
                                            t = c[j >> 2] | 0;
                                            s = c[m >> 2] | 0;
                                            u = 0;
                                            while (1) {
                                                z = c[t + (($(c[l >> 2] | 0, r) | 0) + (u >> k) << 2) >> 2] << p;
                                                if (o) {
                                                    w = 0;
                                                    do {
                                                        y = 1 << w;
                                                        if (!(y & q)) x = 0;
                                                        else x = y << 1 << w;
                                                        z = ((y & u | 0) == 0 ? 0 : y << w) + z + x | 0;
                                                        w = w + 1 | 0
                                                    } while ((w | 0) != (k | 0))
                                                }
                                                c[s + (($(v + 2 | 0, q) | 0) + u << 2) >> 2] = z;
                                                v = c[n >> 2] | 0;
                                                if ((u | 0) < (v | 0)) u = u + 1 | 0;
                                                else break
                                            }
                                        }
                                        if ((q | 0) < (v | 0)) q = q + 1 | 0;
                                        else break
                                    }
                                }
                                if (((c[g + 216 >> 2] | 0) - (c[g + 212 >> 2] | 0) | 0) < 0) {
                                    b = 0;
                                    break
                                }
                                I = b + (h << 2) + 400 | 0;
                                ue(I);
                                c[I >> 2] = c[e >> 2];
                                I = 0;
                                i = f;
                                return I | 0
                            } else b = -12
                        } else b = -1094995529
                    } else b = -1094995529
                } else b = -1094995529;
            while (0);
            ue(e);
            I = b;
            i = f;
            return I | 0
        }

        function Bd(a, b) {
            a = a | 0;
            b = b | 0;
            var d = 0;
            a = i;
            i = i + 16 | 0;
            d = a;
            c[d >> 2] = b;
            ie(b + 1648 | 0);
            ie(b + 1652 | 0);
            ie(b + 1656 | 0);
            ie(b + 1660 | 0);
            ie(b + 1664 | 0);
            ie(b + 1668 | 0);
            ie(b + 1672 | 0);
            ie(b + 1680 | 0);
            ie(b + 1676 | 0);
            ie(b + 1688 | 0);
            ie(d);
            i = a;
            return
        }

        function Cd(a) {
            a = a | 0;
            var d = 0,
                e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0;
            d = i;
            e = a + 136 | 0;
            g = a + 3500 | 0;
            f = a + 7776 | 0;
            while (1) {
                h = (c[e >> 2] | 0) + 204 | 0;
                j = 0;
                do {
                    k = Xd(h, 8) | 0;
                    j = k + j | 0
                } while ((k | 0) == 255);
                k = 0;
                do {
                    l = Xd(h, 8) | 0;
                    k = l + k | 0
                } while ((l | 0) == 255);
                do
                    if ((c[g >> 2] | 0) == 39)
                        if ((j | 0) == 257) {
                            b[f >> 1] = Xd(h, 16) | 0;
                            break
                        } else if ((j | 0) == 256) {
                    Dd(a);
                    break
                } else {
                    Zd(h, k << 3);
                    break
                } else if ((j | 0) == 132) {
                    Dd(a);
                    break
                } else {
                    Zd(h, k << 3);
                    break
                }
                while (0);
                h = c[e >> 2] | 0;
                if (((c[h + 216 >> 2] | 0) - (c[h + 212 >> 2] | 0) | 0) <= 0) {
                    a = 15;
                    break
                }
                if ((Yd(h + 204 | 0, 8) | 0) == 128) {
                    a = 15;
                    break
                }
            }
            if ((a | 0) == 15) {
                i = d;
                return 1
            }
            return 0
        }

        function Dd(b) {
            b = b | 0;
            var d = 0,
                e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0;
            d = i;
            e = (c[b + 136 >> 2] | 0) + 204 | 0;
            g = (Xd(e, 8) | 0) & 255;
            f = b + 7720 | 0;
            h = 0;
            do {
                if ((g | 0) == 1) Zd(e, 16);
                else if (!g) {
                    a[f >> 0] = 1;
                    j = 0;
                    do {
                        a[b + (h << 4) + j + 7672 >> 0] = Xd(e, 8) | 0;
                        j = j + 1 | 0
                    } while ((j | 0) != 16)
                } else if ((g | 0) == 2) Zd(e, 32);
                h = h + 1 | 0
            } while ((h | 0) != 3);
            i = d;
            return
        }

        function Ed(a, b, d) {
            a = a | 0;
            b = b | 0;
            d = d | 0;
            var e = 0,
                f = 0,
                g = 0,
                h = 0;
            d = i;
            f = c[b + 52 >> 2] | 0;
            e = a + 60 | 0;
            if ((f | 0) > 0) {
                if ((c[e >> 2] | 0) == 0 ? (f = le(f) | 0, c[e >> 2] = f, (f | 0) == 0) : 0) {
                    f = -12;
                    i = d;
                    return f | 0
                }
            } else c[e >> 2] = 0;
            f = a + 12 | 0;
            c[f >> 2] = b;
            c[a + 424 >> 2] = 0;
            c[a + 800 >> 2] = 1;
            h = a + 912 | 0;
            g = a + 936 | 0;
            c[h + 0 >> 2] = 0;
            c[h + 4 >> 2] = 0;
            c[h + 8 >> 2] = 0;
            c[h + 12 >> 2] = 0;
            c[g >> 2] = 0;
            c[g + 4 >> 2] = -2147483648;
            g = a + 928 | 0;
            c[g >> 2] = 0;
            c[g + 4 >> 2] = -2147483648;
            a = Ja[c[b + 76 >> 2] & 7](a) | 0;
            if ((a | 0) >= 0) {
                h = 0;
                i = d;
                return h | 0
            }
            ie(e);
            c[f >> 2] = 0;
            h = a;
            i = d;
            return h | 0
        }

        function Fd(a) {
            a = a | 0;
            var b = 0,
                d = 0,
                e = 0,
                f = 0;
            b = i;
            if (!a) {
                i = b;
                return 0
            }
            e = a + 12 | 0;
            f = c[e >> 2] | 0;
            if ((f | 0) != 0 ? (d = c[f + 92 >> 2] | 0, (d | 0) != 0) : 0) Ja[d & 7](a) | 0;
            c[a + 796 >> 2] = 0;
            ie(a + 60 | 0);
            c[e >> 2] = 0;
            c[a + 808 >> 2] = 0;
            i = b;
            return 0
        }

        function Gd(a, b, d, e, f, g) {
            a = a | 0;
            b = b | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            var h = 0,
                j = 0,
                k = 0,
                l = 0;
            h = i;
            if ((f | 0) <= 0) {
                i = h;
                return 0
            }
            j = (e | 0) == 0;
            k = 0;
            do {
                l = d + ($(k, g) | 0) | 0;
                l = Oa[b & 1](a, l) | 0;
                if (!j) c[e + (k << 2) >> 2] = l;
                k = k + 1 | 0
            } while ((k | 0) != (f | 0));
            i = h;
            return 0
        }

        function Hd(a, b, d, e, f) {
            a = a | 0;
            b = b | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            var g = 0,
                h = 0,
                j = 0,
                k = 0;
            g = i;
            if ((f | 0) <= 0) {
                i = g;
                return 0
            }
            h = (e | 0) == 0;
            j = 0;
            do {
                k = Ma[b & 1](a, d, j, 0) | 0;
                if (!h) c[e + (j << 2) >> 2] = k;
                j = j + 1 | 0
            } while ((j | 0) != (f | 0));
            i = g;
            return 0
        }

        function Id(b, f, g) {
            b = b | 0;
            f = f | 0;
            g = g | 0;
            var h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0;
            g = i;
            h = Ge(c[f + 76 >> 2] | 0) | 0;
            b = h + 4 | 0;
            if (!(a[b >> 0] | 0)) {
                p = 0;
                i = g;
                return p | 0
            }
            k = f + 64 | 0;
            l = h + 5 | 0;
            m = f + 68 | 0;
            n = h + 6 | 0;
            j = 0;
            while (1) {
                p = ($((((e[h + (j << 1) + 8 >> 1] | 0) >>> 11 & 15) + 8 | 0) >>> 3, c[k >> 2] | 0) | 0) + 31 & -32;
                if ((j + -1 | 0) >>> 0 < 2) {
                    p = 0 - (0 - p >> d[l >> 0]) | 0;
                    c[f + (j << 2) + 32 >> 2] = p;
                    o = 0 - (0 - ((c[m >> 2] | 0) + 31 & -32) >> d[n >> 0]) | 0
                } else {
                    c[f + (j << 2) + 32 >> 2] = p;
                    o = (c[m >> 2] | 0) + 31 & -32
                }
                o = re(($(p, o) | 0) + 32 | 0) | 0;
                c[f + (j << 2) + 304 >> 2] = o;
                if (!o) {
                    b = -1;
                    f = 8;
                    break
                }
                c[f + (j << 2) >> 2] = c[o + 4 >> 2];
                j = j + 1 | 0;
                if ((j | 0) >= (d[b >> 0] | 0)) {
                    b = 0;
                    f = 8;
                    break
                }
            }
            if ((f | 0) == 8) {
                i = g;
                return b | 0
            }
            return 0
        }

        function Jd(a, b) {
            a = a | 0;
            b = b | 0;
            var d = 0,
                e = 0,
                f = 0,
                g = 0;
            d = i;
            jf(a | 0, 0, 976) | 0;
            e = (b | 0) != 0;
            if (e) {
                c[a + 8 >> 2] = c[b + 8 >> 2];
                c[a + 48 >> 2] = c[b + 12 >> 2]
            } else c[a + 8 >> 2] = -1;
            c[a + 100 >> 2] = 0;
            c[a + 104 >> 2] = 1;
            c[a + 888 >> 2] = 0;
            c[a + 892 >> 2] = 1;
            c[a + 896 >> 2] = 0;
            c[a + 900 >> 2] = 1;
            c[a + 476 >> 2] = 1;
            c[a + 816 >> 2] = 1;
            c[a + 820 >> 2] = 1;
            c[a + 220 >> 2] = 0;
            c[a + 224 >> 2] = 1;
            c[a + 136 >> 2] = -1;
            c[a + 416 >> 2] = -1;
            g = a + 696 | 0;
            c[g >> 2] = 0;
            c[g + 4 >> 2] = -2147483648;
            if ((e ? (f = c[b + 52 >> 2] | 0, (f | 0) != 0) : 0) ? (g = le(f) | 0, c[a + 60 >> 2] = g, (g | 0) == 0) : 0) {
                g = -12;
                i = d;
                return g | 0
            }
            g = 0;
            i = d;
            return g | 0
        }

        function Kd(a) {
            a = a | 0;
            var b = 0,
                c = 0;
            b = i;
            c = ee(976) | 0;
            if (c) {
                if ((Jd(c, a) | 0) < 0) {
                    he(c);
                    c = 0
                }
            } else c = 0;
            i = b;
            return c | 0
        }

        function Ld(a, b, d, e) {
            a = a | 0;
            b = b | 0;
            d = d | 0;
            e = e | 0;
            var f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0;
            f = i;
            i = i + 80 | 0;
            g = f;
            k = g + 0 | 0;
            j = e + 0 | 0;
            h = k + 80 | 0;
            do {
                c[k >> 2] = c[j >> 2];
                k = k + 4 | 0;
                j = j + 4 | 0
            } while ((k | 0) < (h | 0));
            h = a + 12 | 0;
            j = c[h >> 2] | 0;
            if (!j) {
                k = -22;
                i = f;
                return k | 0
            }
            if (c[j + 8 >> 2] | 0) {
                k = -22;
                i = f;
                return k | 0
            }
            c[d >> 2] = 0;
            j = c[a + 124 >> 2] | 0;
            k = c[a + 128 >> 2] | 0;
            if (!j) {
                if (k) {
                    k = -22;
                    i = f;
                    return k | 0
                }
            } else {
                if (!((j | 0) > 0 & (k | 0) > 0)) {
                    k = -22;
                    i = f;
                    return k | 0
                }
                if ((j + 128 | 0) >>> 0 >= (268435455 / ((k + 128 | 0) >>> 0) | 0) >>> 0) {
                    k = -22;
                    i = f;
                    return k | 0
                }
            }
            De(b);
            h = c[h >> 2] | 0;
            if (((c[h + 16 >> 2] & 32 | 0) == 0 ? (c[e + 28 >> 2] | 0) == 0 : 0) ? (c[a + 808 >> 2] & 1 | 0) == 0 : 0) {
                k = 0;
                i = f;
                return k | 0
            }
            g = Ma[c[h + 88 >> 2] & 1](a, b, d, g) | 0;
            if (!(c[d >> 2] | 0)) {
                De(b);
                k = g;
                i = f;
                return k | 0
            } else {
                k = a + 424 | 0;
                c[k >> 2] = (c[k >> 2] | 0) + 1;
                k = g;
                i = f;
                return k | 0
            }
            return 0
        }

        function Md(a, b, c, d) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            c = i;
            if ((a | 0) > 0 & (b | 0) > 0 ? (a + 128 | 0) >>> 0 < (268435455 / ((b + 128 | 0) >>> 0) | 0) >>> 0 : 0) {
                d = 0;
                i = c;
                return d | 0
            }
            d = -22;
            i = c;
            return d | 0
        }

        function Nd(a, b) {
            a = a | 0;
            b = b | 0;
            return 0
        }

        function Od(a, b, d) {
            a = a | 0;
            b = b | 0;
            d = d | 0;
            var e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0;
            f = i;
            e = a + 8 | 0;
            if (!(c[e >> 2] | 0)) {
                g = c[a + 116 >> 2] | 0;
                h = a + 120 | 0;
                j = c[h >> 2] | 0;
                if (!((g | 0) > 0 & (j | 0) > 0)) {
                    l = -22;
                    i = f;
                    return l | 0
                }
                if ((g + 128 | 0) >>> 0 >= (268435455 / ((j + 128 | 0) >>> 0) | 0) >>> 0) {
                    l = -22;
                    i = f;
                    return l | 0
                }
                j = c[a + 136 >> 2] | 0;
                if ((j | 0) < 0) {
                    l = -22;
                    i = f;
                    return l | 0
                }
                k = b + 64 | 0;
                l = b + 68 | 0;
                if ((c[k >> 2] | 0) >= 1 ? (c[l >> 2] | 0) >= 1 : 0) g = 1;
                else {
                    m = a + 792 | 0;
                    n = 0 - (0 - (c[a + 124 >> 2] | 0) >> c[m >> 2]) | 0;
                    c[k >> 2] = (g | 0) > (n | 0) ? g : n;
                    k = c[h >> 2] | 0;
                    g = 0 - (0 - (c[a + 128 >> 2] | 0) >> c[m >> 2]) | 0;
                    c[l >> 2] = (k | 0) > (g | 0) ? k : g;
                    g = 0
                }
                c[b + 76 >> 2] = j
            } else g = 1;
            d = Aa[c[a + 476 >> 2] & 1](a, b, d) | 0;
            if (c[e >> 2] | g) {
                n = d;
                i = f;
                return n | 0
            }
            c[b + 64 >> 2] = c[a + 116 >> 2];
            c[b + 68 >> 2] = c[a + 120 >> 2];
            n = d;
            i = f;
            return n | 0
        }

        function Pd(a, b, d) {
            a = a | 0;
            b = b | 0;
            d = d | 0;
            var e = 0;
            e = i;
            c[b + 4 >> 2] = a;
            a = Od(a, c[b >> 2] | 0, d) | 0;
            i = e;
            return a | 0
        }

        function Qd(a, b) {
            a = a | 0;
            b = b | 0;
            a = i;
            b = c[b >> 2] | 0;
            if (b) De(b);
            i = a;
            return
        }

        function Rd(a) {
            a = a | 0;
            return
        }

        function Sd(a, b, c) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            return
        }

        function Td(a, b, c) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            return
        }

        function Ud(a) {
            a = a | 0;
            var b = 0,
                d = 0;
            b = i;
            d = a + 8 | 0;
            c[d >> 2] = 0;
            c[d + 4 >> 2] = -2147483648;
            d = a + 16 | 0;
            c[d >> 2] = 0;
            c[d + 4 >> 2] = -2147483648;
            d = a + 64 | 0;
            c[d >> 2] = -1;
            c[d + 4 >> 2] = -1;
            d = a + 72 | 0;
            c[d >> 2] = 0;
            c[d + 4 >> 2] = 0;
            d = a + 32 | 0;
            c[a >> 2] = 0;
            c[d + 0 >> 2] = 0;
            c[d + 4 >> 2] = 0;
            c[d + 8 >> 2] = 0;
            c[d + 12 >> 2] = 0;
            c[d + 16 >> 2] = 0;
            i = b;
            return
        }

        function Vd(a, b, e) {
            a = a | 0;
            b = b | 0;
            e = e | 0;
            var f = 0,
                g = 0,
                h = 0;
            g = a + 16 | 0;
            c[a + 12 >> 2] = b;
            c[a + 20 >> 2] = b + e;
            h = b + 1 | 0;
            c[g >> 2] = h;
            e = (d[b >> 0] | 0) << 18;
            c[a >> 2] = e;
            f = b + 2 | 0;
            c[g >> 2] = f;
            e = (d[h >> 0] | 0) << 10 | e;
            c[a >> 2] = e;
            c[g >> 2] = b + 3;
            c[a >> 2] = (d[f >> 0] | 0) << 2 | e | 2;
            c[a + 4 >> 2] = 510;
            return
        }

        function Wd() {
            var b = 0,
                e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0;
            b = i;
            if (!(c[766] | 0)) e = 0;
            else {
                i = b;
                return
            }
            while (1)
                if (e) {
                    g = (e & 65280 | 0) == 0;
                    a[3072 + e >> 0] = (g ? 8 : 0) - (d[4872 + (g ? e : e >>> 8) >> 0] | 0);
                    e = e + 1 | 0;
                    if ((e | 0) == 512) {
                        e = 0;
                        break
                    } else continue
                } else {
                    a[3072] = 9;
                    e = 1;
                    continue
                }
            while (1) {
                f = e << 1;
                g = 0;
                do {
                    j = a[4416 + (e << 2) + g >> 0] | 0;
                    h = (g << 7) + f | 0;
                    a[(h | 1) + 3584 >> 0] = j;
                    a[h + 3584 >> 0] = j;
                    g = g + 1 | 0
                } while ((g | 0) != 4);
                j = (d[4672 + e >> 0] | 0) << 1;
                a[f + 4224 >> 0] = j;
                a[f + 4225 >> 0] = j | 1;
                if (e) {
                    h = (d[4736 + e >> 0] | 0) << 1;
                    j = 128 - f | 0;
                    a[j + 4095 >> 0] = h;
                    a[j + 4094 >> 0] = h | 1;
                    e = e + 1 | 0;
                    if ((e | 0) == 64) break;
                    else continue
                } else {
                    e = 128 - f | 0;
                    a[e + 4095 >> 0] = 1;
                    a[e + 4094 >> 0] = 0;
                    e = 1;
                    continue
                }
            }
            g = 4352 | 0;
            f = 4800 | 0;
            e = g + 63 | 0;
            do {
                a[g >> 0] = a[f >> 0] | 0;
                g = g + 1 | 0;
                f = f + 1 | 0
            } while ((g | 0) < (e | 0));
            c[766] = 1;
            i = b;
            return
        }

        function Xd(a, b) {
            a = a | 0;
            b = b | 0;
            var e = 0,
                f = 0,
                g = 0,
                h = 0;
            e = i;
            f = a + 8 | 0;
            h = c[f >> 2] | 0;
            g = c[a + 16 >> 2] | 0;
            a = (c[a >> 2] | 0) + (h >>> 3) | 0;
            a = (lf(d[a >> 0] | d[a + 1 >> 0] << 8 | d[a + 2 >> 0] << 16 | d[a + 3 >> 0] << 24 | 0) | 0) << (h & 7) >>> (32 - b | 0);
            b = h + b | 0;
            c[f >> 2] = g >>> 0 > b >>> 0 ? b : g;
            i = e;
            return a | 0
        }

        function Yd(a, b) {
            a = a | 0;
            b = b | 0;
            var e = 0,
                f = 0;
            e = i;
            f = c[a + 8 >> 2] | 0;
            a = (c[a >> 2] | 0) + (f >>> 3) | 0;
            a = (lf(d[a >> 0] | d[a + 1 >> 0] << 8 | d[a + 2 >> 0] << 16 | d[a + 3 >> 0] << 24 | 0) | 0) << (f & 7) >>> (32 - b | 0);
            i = e;
            return a | 0
        }

        function Zd(a, b) {
            a = a | 0;
            b = b | 0;
            var d = 0;
            d = a + 8 | 0;
            a = c[a + 16 >> 2] | 0;
            b = (c[d >> 2] | 0) + b | 0;
            c[d >> 2] = a >>> 0 > b >>> 0 ? b : a;
            return
        }

        function _d(a) {
            a = a | 0;
            var b = 0,
                e = 0,
                f = 0;
            e = a + 8 | 0;
            f = c[e >> 2] | 0;
            b = (d[(c[a >> 2] | 0) + (f >>> 3) >> 0] | 0) << (f & 7) >>> 7 & 1;
            c[e >> 2] = ((f | 0) < (c[a + 16 >> 2] | 0) & 1) + f;
            return b | 0
        }

        function $d(a, b) {
            a = a | 0;
            b = b | 0;
            var e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0;
            e = i;
            if (!b) {
                j = 0;
                i = e;
                return j | 0
            }
            f = a + 8 | 0;
            h = c[f >> 2] | 0;
            g = c[a + 16 >> 2] | 0;
            j = c[a >> 2] | 0;
            a = j + (h >>> 3) | 0;
            a = (lf(d[a >> 0] | d[a + 1 >> 0] << 8 | d[a + 2 >> 0] << 16 | d[a + 3 >> 0] << 24 | 0) | 0) << (h & 7);
            if ((b | 0) < 26) {
                j = h + b | 0;
                c[f >> 2] = g >>> 0 > j >>> 0 ? j : g;
                j = a >>> (32 - b | 0);
                i = e;
                return j | 0
            } else {
                k = h + 16 | 0;
                k = g >>> 0 > k >>> 0 ? k : g;
                c[f >> 2] = k;
                h = b + -16 | 0;
                j = j + (k >>> 3) | 0;
                j = (lf(d[j >> 0] | d[j + 1 >> 0] << 8 | d[j + 2 >> 0] << 16 | d[j + 3 >> 0] << 24 | 0) | 0) << (k & 7) >>> (48 - b | 0);
                b = k + h | 0;
                c[f >> 2] = g >>> 0 > b >>> 0 ? b : g;
                j = j | a >>> 16 << h;
                i = e;
                return j | 0
            }
            return 0
        }

        function ae(a) {
            a = a | 0;
            var b = 0,
                e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0;
            b = i;
            i = i + 32 | 0;
            e = b;
            c[e + 0 >> 2] = c[a + 0 >> 2];
            c[e + 4 >> 2] = c[a + 4 >> 2];
            c[e + 8 >> 2] = c[a + 8 >> 2];
            c[e + 12 >> 2] = c[a + 12 >> 2];
            c[e + 16 >> 2] = c[a + 16 >> 2];
            e = $d(e, 32) | 0;
            f = e >>> 0 > 65535;
            e = f ? e >>> 16 : e;
            f = f ? 16 : 0;
            if (e & 65280) {
                f = f | 8;
                e = e >>> 8
            }
            j = 31 - f - (d[4872 + e >> 0] | 0) | 0;
            g = a + 8 | 0;
            f = c[g >> 2] | 0;
            e = 0 - f | 0;
            h = (c[a + 16 >> 2] | 0) - f | 0;
            if ((j | 0) < (e | 0)) {
                h = e;
                h = h + f | 0;
                c[g >> 2] = h;
                j = j + 1 | 0;
                j = $d(a, j) | 0;
                j = j + -1 | 0;
                i = b;
                return j | 0
            }
            h = (h | 0) < (j | 0) ? h : j;
            h = h + f | 0;
            c[g >> 2] = h;
            j = j + 1 | 0;
            j = $d(a, j) | 0;
            j = j + -1 | 0;
            i = b;
            return j | 0
        }

        function be(a) {
            a = a | 0;
            var b = 0;
            b = i;
            a = ae(a) | 0;
            if (!(a & 1)) {
                a = 0 - (a >>> 1) | 0;
                i = b;
                return a | 0
            } else {
                a = (a + 1 | 0) >>> 1;
                i = b;
                return a | 0
            }
            return 0
        }

        function ce(b, c, d, e, f, g, h, j, k, l) {
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            var m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0;
            m = i;
            if ((k | 0) == 0 | (l | 0) == 0) {
                i = m;
                return
            }
            if ((j | 0) < (l | 0)) {
                if ((j | 0) <= (0 - g | 0)) {
                    y = 1 - g | 0;
                    c = c + ($(y - j | 0, e) | 0) | 0;
                    j = y
                }
            } else {
                y = l + -1 | 0;
                c = c + ($(y - j | 0, e) | 0) | 0;
                j = y
            }
            if ((h | 0) < (k | 0)) {
                if ((h | 0) <= (0 - f | 0)) {
                    y = 1 - f | 0;
                    c = c + (y - h) | 0;
                    h = y
                }
            } else {
                y = k + -1 | 0;
                c = c + (y - h) | 0;
                h = y
            }
            s = (j | 0) > 0;
            v = s ? 0 : 0 - j | 0;
            r = (h | 0) > 0;
            n = r ? 0 : 0 - h | 0;
            t = l - j | 0;
            t = (t | 0) < (g | 0) ? t : g;
            o = k - h | 0;
            k = (o | 0) < (f | 0);
            o = k ? o : f;
            p = o - n | 0;
            q = c + (n + ($(v, e) | 0)) | 0;
            y = b + n | 0;
            if ((v | 0) > 0) {
                u = (s ? j : 0) - j | 0;
                w = (r ? h : 0) + ($(u, d) | 0) - h | 0;
                x = 0;
                while (1) {
                    mf(y | 0, q | 0, p | 0) | 0;
                    x = x + 1 | 0;
                    if ((x | 0) >= (v | 0)) break;
                    else y = y + d | 0
                }
                b = b + w | 0
            } else {
                b = y;
                u = 0
            }
            if ((u | 0) < (t | 0)) {
                l = j + -1 - l | 0;
                y = ~g;
                y = (l | 0) > (y | 0) ? l : y;
                l = ~y;
                t = $(~u - y | 0, d) | 0;
                j = (r ? h : 0) + ($((s ? j + -1 | 0 : -1) - j - u - y | 0, e) | 0) - h | 0;
                h = b;
                while (1) {
                    mf(h | 0, q | 0, p | 0) | 0;
                    u = u + 1 | 0;
                    if ((u | 0) == (l | 0)) break;
                    else {
                        h = h + d | 0;
                        q = q + e | 0
                    }
                }
                b = b + t | 0;
                q = c + j | 0;
                u = l
            }
            l = q + (0 - e) | 0;
            if ((u | 0) < (g | 0)) {
                e = $(g - u | 0, d) | 0;
                c = b;
                while (1) {
                    mf(c | 0, l | 0, p | 0) | 0;
                    u = u + 1 | 0;
                    if ((u | 0) == (g | 0)) break;
                    else c = c + d | 0
                }
                b = b + e | 0
            }
            if (!g) {
                i = m;
                return
            }
            e = (n | 0) > 0;
            p = o + -1 | 0;
            c = b + (0 - (($(g, d) | 0) + n)) | 0;
            while (1) {
                g = g + -1 | 0;
                if (e) {
                    q = c + n | 0;
                    l = 0;
                    do {
                        a[c + l >> 0] = a[q >> 0] | 0;
                        l = l + 1 | 0
                    } while ((l | 0) < (n | 0))
                }
                if (k) {
                    l = c + p | 0;
                    q = o;
                    do {
                        a[c + q >> 0] = a[l >> 0] | 0;
                        q = q + 1 | 0
                    } while ((q | 0) < (f | 0))
                }
                if (!g) break;
                else c = c + d | 0
            }
            i = m;
            return
        }

        function de(a, b) {
            a = a | 0;
            b = b | 0;
            c[a >> 2] = 1;
            return
        }

        function ee(a) {
            a = a | 0;
            var b = 0,
                d = 0,
                e = 0;
            b = i;
            d = c[1216] | 0;
            if ((d + -32 | 0) >>> 0 >= a >>> 0) {
                e = $e(a) | 0;
                if ((e | 0) == 0 & (a | 0) == 0)
                    if ((d | 0) == 32) e = 0;
                    else e = $e(1) | 0
            } else e = 0;
            i = b;
            return e | 0
        }

        function fe(a, b) {
            a = a | 0;
            b = b | 0;
            var d = 0;
            d = i;
            if (((c[1216] | 0) + -32 | 0) >>> 0 < b >>> 0) {
                b = 0;
                i = d;
                return b | 0
            }
            b = bf(a, ((b | 0) == 0 & 1) + b | 0) | 0;
            i = d;
            return b | 0
        }

        function ge(a, b, d) {
            a = a | 0;
            b = b | 0;
            d = d | 0;
            var e = 0,
                f = 0;
            e = i;
            f = $(d, b) | 0;
            if ((d | b) >>> 0 > 65535 & (d | 0) != 0 ? ((f >>> 0) / (d >>> 0) | 0 | 0) != (b | 0) : 0) {
                af(a);
                d = 0;
                i = e;
                return d | 0
            }
            if (((c[1216] | 0) + -32 | 0) >>> 0 < f >>> 0) b = 0;
            else b = bf(a, ((f | 0) == 0 & 1) + f | 0) | 0;
            if ((b | 0) != 0 | (f | 0) == 0) {
                d = b;
                i = e;
                return d | 0
            }
            af(a);
            d = 0;
            i = e;
            return d | 0
        }

        function he(a) {
            a = a | 0;
            var b = 0;
            b = i;
            af(a);
            i = b;
            return
        }

        function ie(a) {
            a = a | 0;
            var b = 0;
            b = i;
            af(c[a >> 2] | 0);
            c[a >> 2] = 0;
            i = b;
            return
        }

        function je(a, b, d) {
            a = a | 0;
            b = b | 0;
            d = d | 0;
            var e = 0,
                f = 0;
            e = i;
            if (((d | 0) != 0 ? (2147483647 / (d >>> 0) | 0) >>> 0 > b >>> 0 : 0) ? (f = $(d, b) | 0, ((c[1216] | 0) + -32 | 0) >>> 0 >= f >>> 0) : 0) a = bf(a, ((f | 0) == 0 & 1) + f | 0) | 0;
            else a = 0;
            i = e;
            return a | 0
        }

        function ke(a, b, d) {
            a = a | 0;
            b = b | 0;
            d = d | 0;
            var e = 0,
                f = 0;
            f = i;
            e = ge(c[a >> 2] | 0, b, d) | 0;
            c[a >> 2] = e;
            i = f;
            return ((e | 0) != 0 | (b | 0) == 0 | (d | 0) == 0 ? 0 : -12) | 0
        }

        function le(a) {
            a = a | 0;
            var b = 0,
                c = 0;
            c = i;
            b = ee(a) | 0;
            if (b) jf(b | 0, 0, a | 0) | 0;
            i = c;
            return b | 0
        }

        function me(a, b, d) {
            a = a | 0;
            b = b | 0;
            d = d | 0;
            var e = 0,
                f = 0;
            e = i;
            if ((c[b >> 2] | 0) >>> 0 > d >>> 0) {
                i = e;
                return
            }
            f = ((d * 17 | 0) >>> 4) + 32 | 0;
            d = f >>> 0 > d >>> 0 ? f : d;
            af(c[a >> 2] | 0);
            f = ee(d) | 0;
            c[a >> 2] = f;
            c[b >> 2] = (f | 0) == 0 ? 0 : d;
            i = e;
            return
        }

        function ne(a, b) {
            a = a | 0;
            b = b | 0;
            var c = 0;
            c = i;
            if ((b | 0) != 0 ? (2147483647 / (b >>> 0) | 0) >>> 0 > a >>> 0 : 0) b = ee($(b, a) | 0) | 0;
            else b = 0;
            i = c;
            return b | 0
        }

        function oe(a, b) {
            a = a | 0;
            b = b | 0;
            var c = 0,
                d = 0,
                e = 0;
            c = i;
            if (((b | 0) != 0 ? (2147483647 / (b >>> 0) | 0) >>> 0 > a >>> 0 : 0) ? (e = $(b, a) | 0, d = ee(e) | 0, (d | 0) != 0) : 0) jf(d | 0, 0, e | 0) | 0;
            else d = 0;
            i = c;
            return d | 0
        }

        function pe(a, b, d, e, f) {
            a = a | 0;
            b = b | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            var g = 0,
                h = 0,
                j = 0;
            g = i;
            i = i + 16 | 0;
            h = g;
            j = le(24) | 0;
            c[h >> 2] = j;
            if (!j) {
                f = 0;
                i = g;
                return f | 0
            }
            c[j >> 2] = a;
            c[j + 4 >> 2] = b;
            c[j + 12 >> 2] = (d | 0) != 0 ? d : 7;
            c[j + 16 >> 2] = e;
            c[j + 8 >> 2] = 1;
            if (f & 1) {
                f = (c[h >> 2] | 0) + 20 | 0;
                c[f >> 2] = c[f >> 2] | 1
            }
            j = le(12) | 0;
            if (!j) {
                ie(h);
                f = 0;
                i = g;
                return f | 0
            } else {
                c[j >> 2] = c[h >> 2];
                c[j + 4 >> 2] = a;
                c[j + 8 >> 2] = b;
                f = j;
                i = g;
                return f | 0
            }
            return 0
        }

        function qe(a, b) {
            a = a | 0;
            b = b | 0;
            a = i;
            he(b);
            i = a;
            return
        }

        function re(a) {
            a = a | 0;
            var b = 0,
                d = 0,
                e = 0;
            b = i;
            i = i + 16 | 0;
            d = b;
            e = ee(a) | 0;
            c[d >> 2] = e;
            if (e) {
                a = pe(e, a, 7, 0, 0) | 0;
                if (!a) {
                    ie(d);
                    a = 0
                }
            } else a = 0;
            i = b;
            return a | 0
        }

        function se(a) {
            a = a | 0;
            var b = 0,
                d = 0;
            b = i;
            d = re(a) | 0;
            if (!d) {
                d = 0;
                i = b;
                return d | 0
            }
            jf(c[d + 4 >> 2] | 0, 0, a | 0) | 0;
            i = b;
            return d | 0
        }

        function te(a) {
            a = a | 0;
            var b = 0,
                d = 0,
                e = 0,
                f = 0;
            b = i;
            i = i + 16 | 0;
            e = b;
            d = le(12) | 0;
            if (!d) {
                e = 0;
                i = b;
                return e | 0
            }
            c[d + 0 >> 2] = c[a + 0 >> 2];
            c[d + 4 >> 2] = c[a + 4 >> 2];
            c[d + 8 >> 2] = c[a + 8 >> 2];
            f = (c[a >> 2] | 0) + 8 | 0;
            a = c[f >> 2] | 0;
            c[f >> 2] = a + 1;
            c[e >> 2] = a + 1;
            e = d;
            i = b;
            return e | 0
        }

        function ue(a) {
            a = a | 0;
            var b = 0,
                d = 0,
                e = 0,
                f = 0;
            b = i;
            i = i + 16 | 0;
            e = b + 4 | 0;
            d = b;
            if (!a) {
                i = b;
                return
            }
            f = c[a >> 2] | 0;
            if (!f) {
                i = b;
                return
            }
            f = c[f >> 2] | 0;
            c[d >> 2] = f;
            ie(a);
            a = f + 8 | 0;
            f = c[a >> 2] | 0;
            c[a >> 2] = f + -1;
            c[e >> 2] = f + -1;
            if (c[e >> 2] | 0) {
                i = b;
                return
            }
            f = c[d >> 2] | 0;
            Fa[c[f + 12 >> 2] & 15](c[f + 16 >> 2] | 0, c[f >> 2] | 0);
            ie(d);
            i = b;
            return
        }

        function ve(a, b) {
            a = a | 0;
            b = b | 0;
            var d = 0,
                e = 0;
            d = i;
            e = le(20) | 0;
            if (!e) {
                b = 0;
                i = d;
                return b | 0
            }
            c[e + 12 >> 2] = a;
            c[e + 16 >> 2] = (b | 0) != 0 ? b : 4;
            c[e + 4 >> 2] = 1;
            b = e;
            i = d;
            return b | 0
        }

        function we(a) {
            a = a | 0;
            var b = 0,
                d = 0,
                e = 0,
                f = 0;
            b = i;
            i = i + 16 | 0;
            d = b;
            if (!a) {
                i = b;
                return
            }
            e = c[a >> 2] | 0;
            if (!e) {
                i = b;
                return
            }
            c[a >> 2] = 0;
            f = e + 4 | 0;
            a = c[f >> 2] | 0;
            c[f >> 2] = a + -1;
            c[d >> 2] = a + -1;
            if (c[d >> 2] | 0) {
                i = b;
                return
            }
            xe(e);
            i = b;
            return
        }

        function xe(a) {
            a = a | 0;
            var b = 0,
                d = 0,
                e = 0,
                f = 0;
            b = i;
            i = i + 16 | 0;
            d = b + 4 | 0;
            e = b;
            c[d >> 2] = a;
            if (!(c[a >> 2] | 0)) {
                ie(d);
                i = b;
                return
            }
            do {
                f = c[a >> 2] | 0;
                c[e >> 2] = f;
                c[c[d >> 2] >> 2] = c[f + 16 >> 2];
                f = c[e >> 2] | 0;
                Fa[c[f + 8 >> 2] & 15](c[f + 4 >> 2] | 0, c[f >> 2] | 0);
                ie(e);
                a = c[d >> 2] | 0
            } while ((c[a >> 2] | 0) != 0);
            ie(d);
            i = b;
            return
        }

        function ye(a) {
            a = a | 0;
            var b = 0,
                d = 0,
                e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0;
            d = i;
            i = i + 16 | 0;
            b = d + 4 | 0;
            e = d;
            f = c[a >> 2] | 0;
            j = 0;
            while (1) {
                if ((f | 0) == (j | 0)) {
                    f = 4;
                    break
                }
                g = c[a >> 2] | 0;
                if ((g | 0) == (f | 0)) c[a >> 2] = 0;
                if (!g) {
                    f = 5;
                    break
                } else {
                    j = f;
                    f = g
                }
            }
            if ((f | 0) == 4)
                if (!j) f = 5;
            a: do
                if ((f | 0) == 5) {
                    g = a + 4 | 0;
                    f = a + 8 | 0;
                    b: do
                        if ((c[g >> 2] | 0) <= (c[f >> 2] | 0)) c: while (1) {
                            c[b >> 2] = c[g >> 2];
                            j = c[b >> 2] | 0;
                            c[b >> 2] = c[f >> 2];
                            if ((j | 0) > (c[b >> 2] | 0)) break b;
                            h = c[a >> 2] | 0;
                            j = 0;
                            while (1) {
                                if ((h | 0) == (j | 0)) break;
                                j = c[a >> 2] | 0;
                                if ((j | 0) == (h | 0)) c[a >> 2] = 0;
                                if (!j) continue c;
                                else {
                                    k = h;
                                    h = j;
                                    j = k
                                }
                            }
                            if (j) break a
                        }
                        while (0);
                    j = Ja[c[a + 16 >> 2] & 7](c[a + 12 >> 2] | 0) | 0;
                    c[e >> 2] = j;
                    if (!j) {
                        k = 0;
                        i = d;
                        return k | 0
                    }
                    h = le(20) | 0;
                    if (!h) {
                        ue(e);
                        k = 0;
                        i = d;
                        return k | 0
                    } else {
                        c[h >> 2] = c[c[j >> 2] >> 2];
                        c[h + 4 >> 2] = c[(c[j >> 2] | 0) + 16 >> 2];
                        c[h + 8 >> 2] = c[(c[j >> 2] | 0) + 12 >> 2];
                        c[h + 12 >> 2] = a;
                        c[(c[j >> 2] | 0) + 16 >> 2] = h;
                        c[(c[c[e >> 2] >> 2] | 0) + 12 >> 2] = 8;
                        k = c[g >> 2] | 0;
                        c[g >> 2] = k + 1;
                        c[b >> 2] = k + 1;
                        k = c[f >> 2] | 0;
                        c[f >> 2] = k + 1;
                        c[b >> 2] = k + 1;
                        k = c[e >> 2] | 0;
                        i = d;
                        return k | 0
                    }
                }
            while (0);
            e = j + 16 | 0;
            ze(c[e >> 2] | 0);
            c[e >> 2] = 0;
            e = pe(c[j >> 2] | 0, c[a + 12 >> 2] | 0, 8, j, 0) | 0;
            if (!e) {
                ze(j);
                k = 0;
                i = d;
                return k | 0
            } else {
                j = a + 4 | 0;
                k = c[j >> 2] | 0;
                c[j >> 2] = k + 1;
                c[b >> 2] = k + 1;
                k = e;
                i = d;
                return k | 0
            }
            return 0
        }

        function ze(a) {
            a = a | 0;
            var b = 0,
                d = 0,
                e = 0,
                f = 0,
                g = 0,
                h = 0;
            d = i;
            if (!a) {
                i = d;
                return
            }
            b = c[a + 12 >> 2] | 0;
            f = a + 16 | 0;
            if (!(c[f >> 2] | 0)) e = a;
            else
                do {
                    e = c[f >> 2] | 0;
                    f = e + 16 | 0
                } while ((c[f >> 2] | 0) != 0);
            f = c[b >> 2] | 0;
            if (!f) c[b >> 2] = a;
            if (!f) {
                i = d;
                return
            }
            do {
                f = c[b >> 2] | 0;
                g = 0;
                while (1) {
                    if ((f | 0) == (g | 0)) break;
                    g = c[b >> 2] | 0;
                    if ((g | 0) == (f | 0)) c[b >> 2] = 0;
                    if (!g) {
                        g = 0;
                        break
                    } else {
                        h = f;
                        f = g;
                        g = h
                    }
                }
                f = e + 16 | 0;
                c[f >> 2] = g;
                if (c[f >> 2] | 0)
                    do {
                        e = c[f >> 2] | 0;
                        f = e + 16 | 0
                    } while ((c[f >> 2] | 0) != 0);
                f = c[b >> 2] | 0;
                if (!f) c[b >> 2] = a
            } while ((f | 0) != 0);
            i = d;
            return
        }

        function Ae(a, b) {
            a = a | 0;
            b = b | 0;
            var d = 0,
                e = 0,
                f = 0;
            b = i;
            i = i + 16 | 0;
            e = b;
            d = c[a + 12 >> 2] | 0;
            ze(a);
            f = d + 4 | 0;
            a = c[f >> 2] | 0;
            c[f >> 2] = a + -1;
            c[e >> 2] = a + -1;
            if (c[e >> 2] | 0) {
                i = b;
                return
            }
            xe(d);
            i = b;
            return
        }

        function Be() {
            var a = 0,
                b = 0,
                d = 0;
            a = i;
            b = le(400) | 0;
            if (!b) {
                b = 0;
                i = a;
                return b | 0
            }
            jf(b | 0, 0, 400) | 0;
            d = b + 136 | 0;
            c[d >> 2] = 0;
            c[d + 4 >> 2] = -2147483648;
            d = b + 144 | 0;
            c[d >> 2] = 0;
            c[d + 4 >> 2] = -2147483648;
            d = b + 128 | 0;
            c[d >> 2] = 0;
            c[d + 4 >> 2] = -2147483648;
            d = b + 360 | 0;
            c[d >> 2] = 0;
            c[d + 4 >> 2] = -2147483648;
            d = b + 376 | 0;
            c[d >> 2] = 0;
            c[d + 4 >> 2] = 0;
            d = b + 368 | 0;
            c[d >> 2] = -1;
            c[d + 4 >> 2] = -1;
            c[b + 392 >> 2] = -1;
            c[b + 80 >> 2] = 1;
            c[b + 120 >> 2] = 0;
            c[b + 124 >> 2] = 1;
            c[b + 76 >> 2] = -1;
            c[b + 344 >> 2] = 2;
            c[b + 348 >> 2] = 2;
            c[b + 352 >> 2] = 2;
            c[b + 340 >> 2] = 0;
            c[b + 356 >> 2] = 0;
            i = a;
            return b | 0
        }

        function Ce(a) {
            a = a | 0;
            var b = 0,
                d = 0;
            b = i;
            if ((a | 0) != 0 ? (d = c[a >> 2] | 0, (d | 0) != 0) : 0) {
                De(d);
                ie(a)
            }
            i = b;
            return
        }

        function De(a) {
            a = a | 0;
            var b = 0,
                d = 0;
            b = i;
            ue(a + 304 | 0);
            ue(a + 308 | 0);
            ue(a + 312 | 0);
            ue(a + 316 | 0);
            ue(a + 320 | 0);
            ue(a + 324 | 0);
            ue(a + 328 | 0);
            ue(a + 332 | 0);
            jf(a | 0, 0, 400) | 0;
            d = a + 136 | 0;
            c[d >> 2] = 0;
            c[d + 4 >> 2] = -2147483648;
            d = a + 144 | 0;
            c[d >> 2] = 0;
            c[d + 4 >> 2] = -2147483648;
            d = a + 128 | 0;
            c[d >> 2] = 0;
            c[d + 4 >> 2] = -2147483648;
            d = a + 360 | 0;
            c[d >> 2] = 0;
            c[d + 4 >> 2] = -2147483648;
            d = a + 376 | 0;
            c[d >> 2] = 0;
            c[d + 4 >> 2] = 0;
            d = a + 368 | 0;
            c[d >> 2] = -1;
            c[d + 4 >> 2] = -1;
            c[a + 392 >> 2] = -1;
            c[a + 80 >> 2] = 1;
            c[a + 120 >> 2] = 0;
            c[a + 124 >> 2] = 1;
            c[a + 76 >> 2] = -1;
            c[a + 344 >> 2] = 2;
            c[a + 348 >> 2] = 2;
            c[a + 352 >> 2] = 2;
            c[a + 340 >> 2] = 0;
            c[a + 356 >> 2] = 0;
            i = b;
            return
        }

        function Ee(a, b) {
            a = a | 0;
            b = b | 0;
            var d = 0;
            d = i;
            mf(a | 0, b | 0, 400) | 0;
            jf(b | 0, 0, 400) | 0;
            a = b + 136 | 0;
            c[a >> 2] = 0;
            c[a + 4 >> 2] = -2147483648;
            a = b + 144 | 0;
            c[a >> 2] = 0;
            c[a + 4 >> 2] = -2147483648;
            a = b + 128 | 0;
            c[a >> 2] = 0;
            c[a + 4 >> 2] = -2147483648;
            a = b + 360 | 0;
            c[a >> 2] = 0;
            c[a + 4 >> 2] = -2147483648;
            a = b + 376 | 0;
            c[a >> 2] = 0;
            c[a + 4 >> 2] = 0;
            a = b + 368 | 0;
            c[a >> 2] = -1;
            c[a + 4 >> 2] = -1;
            c[b + 392 >> 2] = -1;
            c[b + 80 >> 2] = 1;
            c[b + 120 >> 2] = 0;
            c[b + 124 >> 2] = 1;
            c[b + 76 >> 2] = -1;
            c[b + 344 >> 2] = 2;
            c[b + 348 >> 2] = 2;
            c[b + 352 >> 2] = 2;
            c[b + 340 >> 2] = 0;
            c[b + 356 >> 2] = 0;
            i = d;
            return
        }

        function Fe(a, b) {
            a = a | 0;
            b = b | 0;
            var d = 0,
                e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0;
            d = i;
            c[a + 76 >> 2] = c[b + 76 >> 2];
            c[a + 64 >> 2] = c[b + 64 >> 2];
            c[a + 68 >> 2] = c[b + 68 >> 2];
            c[a + 388 >> 2] = c[b + 388 >> 2];
            j = b + 296 | 0;
            h = c[j + 4 >> 2] | 0;
            f = a + 296 | 0;
            c[f >> 2] = c[j >> 2];
            c[f + 4 >> 2] = h;
            c[a + 72 >> 2] = c[b + 72 >> 2];
            f = c[b + 304 >> 2] | 0;
            if (!f) wa();
            else {
                e = f;
                g = 0
            }
            while (1) {
                if ((e | 0) != 0 ? (j = te(e) | 0, c[a + (g << 2) + 304 >> 2] = j, (j | 0) == 0) : 0) {
                    e = 5;
                    break
                }
                g = g + 1 | 0;
                if (g >>> 0 >= 8) {
                    e = 8;
                    break
                }
                e = c[b + (g << 2) + 304 >> 2] | 0
            }
            if ((e | 0) == 5) {
                De(a);
                j = -12;
                i = d;
                return j | 0
            } else if ((e | 0) == 8) {
                c[a + 0 >> 2] = c[b + 0 >> 2];
                c[a + 4 >> 2] = c[b + 4 >> 2];
                c[a + 8 >> 2] = c[b + 8 >> 2];
                c[a + 12 >> 2] = c[b + 12 >> 2];
                c[a + 16 >> 2] = c[b + 16 >> 2];
                c[a + 20 >> 2] = c[b + 20 >> 2];
                c[a + 24 >> 2] = c[b + 24 >> 2];
                c[a + 28 >> 2] = c[b + 28 >> 2];
                j = a + 32 | 0;
                h = b + 32 | 0;
                c[j + 0 >> 2] = c[h + 0 >> 2];
                c[j + 4 >> 2] = c[h + 4 >> 2];
                c[j + 8 >> 2] = c[h + 8 >> 2];
                c[j + 12 >> 2] = c[h + 12 >> 2];
                c[j + 16 >> 2] = c[h + 16 >> 2];
                c[j + 20 >> 2] = c[h + 20 >> 2];
                c[j + 24 >> 2] = c[h + 24 >> 2];
                c[j + 28 >> 2] = c[h + 28 >> 2];
                j = 0;
                i = d;
                return j | 0
            }
            return 0
        }

        function Ge(a) {
            a = a | 0;
            var b = 0,
                d = 0,
                e = 0,
                f = 0;
            d = i;
            e = 0;
            while (1) {
                f = e + 1 | 0;
                if ((c[5128 + (e * 24 | 0) >> 2] | 0) == (a | 0)) break;
                if (f >>> 0 < 4) e = f;
                else {
                    e = 0;
                    b = 5;
                    break
                }
            }
            if ((b | 0) == 5) {
                i = d;
                return e | 0
            }
            f = 5132 + (e * 24 | 0) | 0;
            i = d;
            return f | 0
        }

        function He(b, d, e) {
            b = b | 0;
            d = d | 0;
            e = e | 0;
            var f = 0,
                g = 0;
            f = i;
            g = (c[b + 24 >> 2] | 0) == 0 ? 1 : 3;
            if ((g | 0) > (e | 0)) {
                b = c[b + 8 >> 2] | 0;
                c[d >> 2] = c[b + (e << 2) + 32 >> 2];
                b = c[b + (e << 2) >> 2] | 0;
                i = f;
                return b | 0
            }
            if ((a[b + 29 >> 0] | 0) != 0 & (g | 0) == (e | 0)) {
                b = c[b + 12 >> 2] | 0;
                c[d >> 2] = c[b + 32 >> 2];
                b = c[b >> 2] | 0;
                i = f;
                return b | 0
            } else {
                c[d >> 2] = 0;
                b = 0;
                i = f;
                return b | 0
            }
            return 0
        }

        function Ie(d, e) {
            d = d | 0;
            e = e | 0;
            var f = 0,
                g = 0,
                h = 0;
            f = i;
            if (!(c[d + 8 >> 2] | 0)) {
                h = -1;
                i = f;
                return h | 0
            }
            c[e >> 2] = c[d + 16 >> 2];
            c[e + 4 >> 2] = c[d + 20 >> 2];
            a[e + 8 >> 0] = c[d + 24 >> 2];
            g = d + 31 | 0;
            if (!(a[d + 29 >> 0] | 0)) h = 0;
            else h = (a[g >> 0] | 0) == 0 & 1;
            a[e + 9 >> 0] = h;
            a[e + 12 >> 0] = a[d + 33 >> 0] | 0;
            a[e + 13 >> 0] = a[g >> 0] | 0;
            a[e + 14 >> 0] = a[d + 32 >> 0] | 0;
            a[e + 10 >> 0] = c[d + 36 >> 2];
            a[e + 11 >> 0] = a[d + 30 >> 0] | 0;
            a[e + 15 >> 0] = a[d + 34 >> 0] | 0;
            b[e + 16 >> 1] = b[d + 48 >> 1] | 0;
            h = 0;
            i = f;
            return h | 0
        }

        function Je(b, e) {
            b = b | 0;
            e = e | 0;
            var f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0.0,
                p = 0,
                q = 0.0,
                r = 0.0,
                s = 0.0,
                t = 0.0,
                u = 0,
                v = 0,
                w = 0.0,
                x = 0.0,
                y = 0.0;
            f = i;
            i = i + 32 | 0;
            k = f + 12 | 0;
            h = f;
            if (!(c[b + 8 >> 2] | 0)) {
                u = -1;
                i = f;
                return u | 0
            }
            g = b + 68 | 0;
            do
                if (a[g >> 0] | 0) {
                    if (!(a[b + 34 >> 0] | 0)) {
                        u = -1;
                        i = f;
                        return u | 0
                    }
                    if (!(a[b + 41 >> 0] | 0)) {
                        u = -1;
                        i = f;
                        return u | 0
                    }
                    if ((c[b + 72 >> 2] | 0) != (e | 0)) {
                        u = -1;
                        i = f;
                        return u | 0
                    }
                    e = b + 60 | 0;
                    j = c[e >> 2] | 0;
                    g = c[b + 64 >> 2] | 0;
                    if ((j | 0) >= (g | 0)) {
                        u = -1;
                        i = f;
                        return u | 0
                    }
                    u = (c[b + 56 >> 2] | 0) + j | 0;
                    c[k >> 2] = 0;
                    c[k + 4 >> 2] = 0;
                    c[k + 8 >> 2] = 0;
                    c[h >> 2] = 0;
                    c[h + 4 >> 2] = 0;
                    c[h + 8 >> 2] = 0;
                    g = Te(b, k, h, u, g - j | 0, 0) | 0;
                    he(c[k >> 2] | 0);
                    he(c[h >> 2] | 0);
                    if ((g | 0) < 0) {
                        u = -1;
                        i = f;
                        return u | 0
                    } else {
                        c[e >> 2] = (c[e >> 2] | 0) + g;
                        h = b + 24 | 0;
                        break
                    }
                } else {
                    if (e >>> 0 > 1) {
                        u = -1;
                        i = f;
                        return u | 0
                    }
                    a[b + 76 >> 0] = (e | 0) == 1 & 1;
                    m = b + 77 | 0;
                    a[m >> 0] = 0;
                    a[b + 78 >> 0] = 0;
                    h = b + 24 | 0;
                    if (((c[h >> 2] | 0) + -1 | 0) >>> 0 < 2 ? (u = b + 16 | 0, p = c[u >> 2] | 0, l = b + 84 | 0, c[l >> 2] = (p + 1 | 0) / 2 | 0, c[b + 88 >> 2] = ((c[b + 20 >> 2] | 0) + 1 | 0) / 2 | 0, c[b + 124 >> 2] = ee(p) | 0, c[b + 128 >> 2] = ee(c[u >> 2] | 0) | 0, c[b + 196 >> 2] = ee((c[l >> 2] << 1) + 14 | 0) | 0, (c[h >> 2] | 0) == 1) : 0) {
                        k = 0;
                        do {
                            c[b + (k << 2) + 132 >> 2] = ee(c[l >> 2] | 0) | 0;
                            c[b + (k << 2) + 164 >> 2] = ee(c[l >> 2] | 0) | 0;
                            k = k + 1 | 0
                        } while ((k | 0) != 8)
                    }
                    k = d[b + 30 >> 0] | 0;
                    v = (a[m >> 0] | 0) != 0 ? 16 : 8;
                    l = b + 36 | 0;
                    u = c[l >> 2] | 0;
                    m = a[b + 32 >> 0] | 0;
                    n = m & 255;
                    p = 30 - v | 0;
                    o = +((1 << v) + -1 | 0) * +(1 << p | 0);
                    q = o / +((1 << k) + -1 | 0);
                    m = m << 24 >> 24 != 0;
                    if (m) {
                        v = k + -8 | 0;
                        r = o / +(224 << v | 0);
                        o = o / +(219 << v | 0)
                    } else {
                        r = q;
                        o = q
                    }
                    if ((u | 0) == 4) {
                        s = .0593;
                        t = .2627;
                        j = 12
                    } else if ((u | 0) == 3) {
                        s = .0722;
                        t = .2126;
                        j = 12
                    } else if (!u) {
                        s = .114;
                        t = .299;
                        j = 12
                    }
                    if ((j | 0) == 12) {
                        y = 1.0 - t;
                        c[b + 220 >> 2] = va(+(r * y * 2.0)) | 0;
                        w = 1.0 - s;
                        x = w - t;
                        c[b + 224 >> 2] = va(+(r * (s * 2.0 * w / x))) | 0;
                        c[b + 228 >> 2] = va(+(r * (t * 2.0 * y / x))) | 0;
                        c[b + 232 >> 2] = va(+(r * w * 2.0)) | 0
                    }
                    j = va(+q) | 0;
                    c[b + 208 >> 2] = j;
                    c[b + 200 >> 2] = p;
                    p = 1 << p + -1;
                    u = b + 204 | 0;
                    c[u >> 2] = p;
                    c[b + 236 >> 2] = 1 << k + -1;
                    if (m) {
                        v = va(+o) | 0;
                        c[b + 212 >> 2] = v;
                        v = $(v, -16 << k + -8) | 0;
                        c[b + 216 >> 2] = v + (c[u >> 2] | 0)
                    } else {
                        c[b + 212 >> 2] = j;
                        c[b + 216 >> 2] = p
                    }
                    c[b + 240 >> 2] = k;
                    c[b + 244 >> 2] = n;
                    if (!(c[h >> 2] | 0)) c[b + 248 >> 2] = 4;
                    else c[b + 248 >> 2] = c[6256 + (c[l >> 2] << 2) >> 2];
                    a[g >> 0] = 1;
                    c[b + 72 >> 2] = e
                }
            while (0);
            c[b + 92 >> 2] = He(b, b + 108 | 0, 0) | 0;
            if (!(c[h >> 2] | 0)) e = 1;
            else {
                c[b + 96 >> 2] = He(b, b + 112 | 0, 1) | 0;
                c[b + 100 >> 2] = He(b, b + 116 | 0, 2) | 0;
                e = 3
            }
            if (!(a[b + 29 >> 0] | 0)) c[b + 104 >> 2] = 0;
            else c[b + 104 >> 2] = He(b, b + 120 | 0, e) | 0;
            c[b + 80 >> 2] = 0;
            v = 0;
            i = f;
            return v | 0
        }

        function Ke(b, d, f) {
            b = b | 0;
            d = d | 0;
            f = f | 0;
            var g = 0,
                h = 0;
            g = i;
            h = c[b + 8 >> 2] | 0;
            if ((h | 0) != 0 ? (a[b + 34 >> 0] | 0) != 0 : 0) {
                h = h + 128 | 0;
                h = rf(e[b + 50 >> 1] | 0, 0, c[h >> 2] | 0, c[h + 4 >> 2] | 0) | 0;
                c[d >> 2] = h;
                d = e[b + 52 >> 1] | 0;
                c[f >> 2] = d;
                i = g;
                return
            }
            c[d >> 2] = 0;
            d = 1;
            c[f >> 2] = d;
            i = g;
            return
        }

        function Le(b, e) {
            b = b | 0;
            e = e | 0;
            var f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0;
            g = i;
            h = b + 80 | 0;
            l = c[h >> 2] | 0;
            if (l >>> 0 >= (c[b + 20 >> 2] | 0) >>> 0) {
                u = -1;
                i = g;
                return u | 0
            }
            f = c[b + 16 >> 2] | 0;
            m = (c[b + 92 >> 2] | 0) + ($(c[b + 108 >> 2] | 0, l) | 0) | 0;
            j = b + 76 | 0;
            if (!(a[j >> 0] | 0)) k = (a[b + 78 >> 0] | 0) != 0 ? 4 : 3;
            else k = 4;
            n = c[b + 24 >> 2] | 0;
            if ((n | 0) == 2) {
                u = (c[b + 96 >> 2] | 0) + ($(c[b + 112 >> 2] | 0, l) | 0) | 0;
                p = (c[b + 100 >> 2] | 0) + ($(c[b + 116 >> 2] | 0, l) | 0) | 0;
                t = b + 124 | 0;
                q = b + 30 | 0;
                r = b + 28 | 0;
                s = b + 196 | 0;
                Ne(c[t >> 2] | 0, u, f, d[q >> 0] | 0, d[r >> 0] | 0, c[s >> 2] | 0);
                u = b + 128 | 0;
                Ne(c[u >> 2] | 0, p, f, d[q >> 0] | 0, d[r >> 0] | 0, c[s >> 2] | 0);
                Qa[c[b + 248 >> 2] & 7](b + 200 | 0, e, m, c[t >> 2] | 0, c[u >> 2] | 0, f, k)
            } else if (!n) Qa[c[b + 248 >> 2] & 7](b + 200 | 0, e, m, 0, 0, f, k);
            else if ((n | 0) == 1) {
                if (!l) {
                    n = b + 96 | 0;
                    o = b + 112 | 0;
                    p = b + 100 | 0;
                    q = b + 116 | 0;
                    r = b + 84 | 0;
                    s = b + 88 | 0;
                    t = 0;
                    do {
                        u = (t | 0) > 4 ? t + -8 | 0 : t;
                        if ((u | 0) < 0) u = 0;
                        else {
                            v = c[s >> 2] | 0;
                            u = (u | 0) < (v | 0) ? u : v + -1 | 0
                        }
                        w = (c[n >> 2] | 0) + ($(c[o >> 2] | 0, u) | 0) | 0;
                        v = (c[p >> 2] | 0) + ($(c[q >> 2] | 0, u) | 0) | 0;
                        mf(c[b + (t << 2) + 132 >> 2] | 0, w | 0, c[r >> 2] | 0) | 0;
                        mf(c[b + (t << 2) + 164 >> 2] | 0, v | 0, c[r >> 2] | 0) | 0;
                        t = t + 1 | 0
                    } while ((t | 0) != 8)
                }
                o = l >> 1;
                q = (o | 0) % 8 | 0;
                w = l & 1;
                n = b + 124 | 0;
                t = b + 196 | 0;
                u = b + 30 | 0;
                v = b + 28 | 0;
                Me(c[n >> 2] | 0, b + 132 | 0, f, q, c[t >> 2] | 0, d[u >> 0] | 0, w, d[v >> 0] | 0);
                p = b + 128 | 0;
                Me(c[p >> 2] | 0, b + 164 | 0, f, q, c[t >> 2] | 0, d[u >> 0] | 0, w, d[v >> 0] | 0);
                if (w) {
                    u = (q + 5 | 0) % 8 | 0;
                    t = o + 5 | 0;
                    v = c[b + 88 >> 2] | 0;
                    v = (t | 0) < (v | 0) ? t : v + -1 | 0;
                    t = (c[b + 96 >> 2] | 0) + ($(v, c[b + 112 >> 2] | 0) | 0) | 0;
                    v = (c[b + 100 >> 2] | 0) + ($(c[b + 116 >> 2] | 0, v) | 0) | 0;
                    w = b + 84 | 0;
                    mf(c[b + (u << 2) + 132 >> 2] | 0, t | 0, c[w >> 2] | 0) | 0;
                    mf(c[b + (u << 2) + 164 >> 2] | 0, v | 0, c[w >> 2] | 0) | 0
                }
                Qa[c[b + 248 >> 2] & 7](b + 200 | 0, e, m, c[n >> 2] | 0, c[p >> 2] | 0, f, k)
            } else if ((n | 0) == 3) {
                v = (c[b + 96 >> 2] | 0) + ($(c[b + 112 >> 2] | 0, l) | 0) | 0;
                w = (c[b + 100 >> 2] | 0) + ($(c[b + 116 >> 2] | 0, l) | 0) | 0;
                Qa[c[b + 248 >> 2] & 7](b + 200 | 0, e, m, v, w, f, k)
            } else {
                w = -1;
                i = g;
                return w | 0
            }
            a: do
                if (!(a[b + 31 >> 0] | 0)) {
                    if (a[j >> 0] | 0) {
                        if (!(a[b + 29 >> 0] | 0)) {
                            if ((f | 0) <= 0) break;
                            b = e + 3 | 0;
                            e = 0;
                            while (1) {
                                a[b >> 0] = -1;
                                e = e + 1 | 0;
                                if ((e | 0) == (f | 0)) break a;
                                else b = b + 4 | 0
                            }
                        }
                        j = c[b + 104 >> 2] | 0;
                        k = $(c[b + 120 >> 2] | 0, l) | 0;
                        o = e + 3 | 0;
                        if ((c[b + 240 >> 2] | 0) == 8) {
                            if ((f | 0) > 0) {
                                l = 0;
                                while (1) {
                                    a[o >> 0] = a[j + (l + k) >> 0] | 0;
                                    l = l + 1 | 0;
                                    if ((l | 0) == (f | 0)) break;
                                    else o = o + 4 | 0
                                }
                            }
                        } else {
                            l = c[b + 208 >> 2] | 0;
                            m = c[b + 204 >> 2] | 0;
                            n = c[b + 200 >> 2] | 0;
                            if ((f | 0) > 0) {
                                p = 0;
                                while (1) {
                                    a[o >> 0] = ($(d[j + (p + k) >> 0] | 0, l) | 0) + m >> n;
                                    p = p + 1 | 0;
                                    if ((p | 0) == (f | 0)) break;
                                    else o = o + 4 | 0
                                }
                            }
                        }
                        if (a[b + 33 >> 0] | 0) {
                            if (!(c[1306] | 0)) {
                                c[1306] = 1;
                                b = 1;
                                do {
                                    c[5232 + (b << 2) >> 2] = (((b | 0) / 2 | 0) + 16711808 | 0) / (b | 0) | 0;
                                    b = b + 1 | 0
                                } while ((b | 0) != 256)
                            }
                            if ((f | 0) > 0) {
                                b = 0;
                                while (1) {
                                    k = a[e + 3 >> 0] | 0;
                                    if (!(k << 24 >> 24)) {
                                        a[e >> 0] = -1;
                                        a[e + 1 >> 0] = -1;
                                        a[e + 2 >> 0] = -1
                                    } else {
                                        j = c[5232 + ((k & 255) << 2) >> 2] | 0;
                                        l = a[e >> 0] | 0;
                                        if ((l & 255) < (k & 255)) l = (($(l & 255, j) | 0) + 32768 | 0) >>> 16 & 255;
                                        else l = -1;
                                        a[e >> 0] = l;
                                        l = e + 1 | 0;
                                        m = a[l >> 0] | 0;
                                        if ((m & 255) < (k & 255)) m = (($(m & 255, j) | 0) + 32768 | 0) >>> 16 & 255;
                                        else m = -1;
                                        a[l >> 0] = m;
                                        l = e + 2 | 0;
                                        m = a[l >> 0] | 0;
                                        if ((m & 255) < (k & 255)) j = (($(m & 255, j) | 0) + 32768 | 0) >>> 16 & 255;
                                        else j = -1;
                                        a[l >> 0] = j
                                    }
                                    b = b + 1 | 0;
                                    if ((b | 0) == (f | 0)) break;
                                    else e = e + 4 | 0
                                }
                            }
                        }
                    }
                } else {
                    m = c[b + 104 >> 2] | 0;
                    l = $(c[b + 120 >> 2] | 0, l) | 0;
                    b = c[b + 240 >> 2] | 0;
                    q = 1 << b + -1;
                    p = (f | 0) > 0;
                    if (p) {
                        o = e;
                        n = 0;
                        while (1) {
                            v = d[m + (n + l) >> 0] | 0;
                            a[o >> 0] = ($(d[o >> 0] | 0, v) | 0) + q >> b;
                            w = o + 1 | 0;
                            a[w >> 0] = ($(d[w >> 0] | 0, v) | 0) + q >> b;
                            w = o + 2 | 0;
                            a[w >> 0] = ($(d[w >> 0] | 0, v) | 0) + q >> b;
                            n = n + 1 | 0;
                            if ((n | 0) == (f | 0)) break;
                            else o = o + k | 0
                        }
                    }
                    if (!((a[j >> 0] | 0) == 0 | p ^ 1)) {
                        e = e + 3 | 0;
                        b = 0;
                        while (1) {
                            a[e >> 0] = -1;
                            b = b + 1 | 0;
                            if ((b | 0) == (f | 0)) break;
                            else e = e + 4 | 0
                        }
                    }
                }
            while (0);
            c[h >> 2] = (c[h >> 2] | 0) + 1;
            w = 0;
            i = g;
            return w | 0
        }

        function Me(e, f, g, h, j, k, l, m) {
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            m = m | 0;
            var n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0;
            n = i;
            p = c[f + ((h + 5 & 7) << 2) >> 2] | 0;
            t = c[f + ((h + 6 & 7) << 2) >> 2] | 0;
            q = c[f + ((h + 7 & 7) << 2) >> 2] | 0;
            s = c[f + ((h & 7) << 2) >> 2] | 0;
            r = c[f + ((h + 1 & 7) << 2) >> 2] | 0;
            o = c[f + ((h + 2 & 7) << 2) >> 2] | 0;
            f = c[f + ((h + 3 & 7) << 2) >> 2] | 0;
            u = k + -8 | 0;
            v = 1 << u >> 1;
            h = (g + 1 | 0) / 2 | 0;
            w = (g | 0) > 0;
            if (!l) {
                if (w) {
                    l = 0;
                    do {
                        y = $(d[t + l >> 0] | 0, -6) | 0;
                        z = $(d[r + l >> 0] | 0, -10) | 0;
                        b[j + (l + 3 << 1) >> 1] = (d[p + l >> 0] << 1) + v + y + ((d[q + l >> 0] | 0) * 18 | 0) + ((d[s + l >> 0] | 0) * 57 | 0) + z + (d[o + l >> 0] << 2) - (d[f + l >> 0] | 0) >> u;
                        l = l + 1 | 0
                    } while ((l | 0) < (h | 0))
                }
            } else if (w) {
                l = 0;
                do {
                    y = $(d[q + l >> 0] | 0, -10) | 0;
                    z = $(d[o + l >> 0] | 0, -6) | 0;
                    b[j + (l + 3 << 1) >> 1] = v - (d[p + l >> 0] | 0) + (d[t + l >> 0] << 2) + y + ((d[s + l >> 0] | 0) * 57 | 0) + ((d[r + l >> 0] | 0) * 18 | 0) + z + (d[f + l >> 0] << 1) >> u;
                    l = l + 1 | 0
                } while ((l | 0) < (h | 0))
            }
            o = j + 6 | 0;
            z = b[o >> 1] | 0;
            b[j >> 1] = z;
            q = j + 2 | 0;
            b[q >> 1] = z;
            p = j + 4 | 0;
            b[p >> 1] = z;
            z = b[j + (h + 2 << 1) >> 1] | 0;
            b[j + (h + 3 << 1) >> 1] = z;
            b[j + (h + 4 << 1) >> 1] = z;
            b[j + (h + 5 << 1) >> 1] = z;
            b[j + (h + 6 << 1) >> 1] = z;
            h = (1 << k) + -1 | 0;
            if (!m) {
                p = 14 - k | 0;
                m = 1 << p >> 1;
                t = 20 - k | 0;
                s = 1 << t + -1;
                if ((g | 0) > 1) {
                    r = g + -2 | 0;
                    k = r >>> 1;
                    q = k << 1;
                    f = e;
                    while (1) {
                        u = (b[o >> 1] | 0) + m >> p;
                        if ((u | 0) < 0) u = 0;
                        else u = ((u | 0) > (h | 0) ? h : u) & 255;
                        a[f >> 0] = u;
                        z = $((b[o + 4 >> 1] | 0) + (b[o + -2 >> 1] | 0) | 0, -11) | 0;
                        u = o;
                        o = o + 2 | 0;
                        u = s - (b[u + -6 >> 1] | 0) - (b[u + 8 >> 1] | 0) + ((b[u + 6 >> 1] | 0) + (b[u + -4 >> 1] | 0) << 2) + z + (((b[o >> 1] | 0) + (b[u >> 1] | 0) | 0) * 40 | 0) >> t;
                        if ((u | 0) < 0) u = 0;
                        else u = ((u | 0) > (h | 0) ? h : u) & 255;
                        a[f + 1 >> 0] = u;
                        g = g + -2 | 0;
                        if ((g | 0) <= 1) break;
                        else f = f + 2 | 0
                    }
                    e = e + (q + 2) | 0;
                    g = r - q | 0;
                    o = j + (k + 4 << 1) | 0
                }
                if (!g) {
                    i = n;
                    return
                }
                j = (b[o >> 1] | 0) + m >> p;
                if ((j | 0) < 0) j = 0;
                else j = ((j | 0) > (h | 0) ? h : j) & 255;
                a[e >> 0] = j;
                i = n;
                return
            } else {
                k = 20 - k | 0;
                m = 1 << k + -1;
                l = b[j >> 1] | 0;
                v = b[q >> 1] | 0;
                u = b[p >> 1] | 0;
                f = b[o >> 1] | 0;
                s = b[j + 8 >> 1] | 0;
                t = b[j + 10 >> 1] | 0;
                if ((g | 0) > 1) {
                    r = g + -2 | 0;
                    p = r >>> 1;
                    q = p << 1;
                    x = e;
                    while (1) {
                        w = b[o + 6 >> 1] | 0;
                        y = f * 57 | 0;
                        z = (t << 2) + m + ($(s, -10) | 0) + y + (u * 18 | 0) + ($(v, -6) | 0) + (l << 1) - w >> k;
                        if ((z | 0) < 0) z = 0;
                        else z = ((z | 0) > (h | 0) ? h : z) & 255;
                        a[x >> 0] = z;
                        l = ($(t, -6) | 0) + m + (s * 18 | 0) + y + ($(u, -10) | 0) - l + (v << 2) + (w << 1) >> k;
                        if ((l | 0) < 0) l = 0;
                        else l = ((l | 0) > (h | 0) ? h : l) & 255;
                        a[x + 1 >> 0] = l;
                        g = g + -2 | 0;
                        if ((g | 0) <= 1) break;
                        else {
                            B = t;
                            A = s;
                            y = f;
                            z = u;
                            l = v;
                            t = w;
                            x = x + 2 | 0;
                            o = o + 2 | 0;
                            s = B;
                            f = A;
                            u = y;
                            v = z
                        }
                    }
                    l = v;
                    v = u;
                    u = f;
                    f = s;
                    s = t;
                    t = w;
                    e = e + (q + 2) | 0;
                    g = r - q | 0;
                    o = j + (p + 4 << 1) | 0
                }
                if (!g) {
                    i = n;
                    return
                }
                j = (t << 2) + m + ($(s, -10) | 0) + (f * 57 | 0) + (u * 18 | 0) + ($(v, -6) | 0) + (l << 1) - (b[o + 6 >> 1] | 0) >> k;
                if ((j | 0) < 0) j = 0;
                else j = ((j | 0) > (h | 0) ? h : j) & 255;
                a[e >> 0] = j;
                i = n;
                return
            }
        }

        function Ne(b, c, e, f, g, h) {
            b = b | 0;
            c = c | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            var j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0;
            j = i;
            v = (e + 1 | 0) / 2 | 0;
            k = h + 3 | 0;
            mf(k | 0, c | 0, v | 0) | 0;
            jf(h | 0, a[c >> 0] | 0, 3) | 0;
            jf(h + (v + 3) | 0, a[c + (v + -1) >> 0] | 0, 4) | 0;
            c = (1 << f) + -1 | 0;
            if (!g) {
                if ((e | 0) > 1) {
                    f = e + -2 | 0;
                    g = f >>> 1;
                    l = g << 1;
                    m = b;
                    while (1) {
                        a[m >> 0] = a[k >> 0] | 0;
                        v = $((d[k + 2 >> 0] | 0) + (d[k + -1 >> 0] | 0) | 0, -11) | 0;
                        n = k;
                        k = k + 1 | 0;
                        n = 32 - (d[n + -3 >> 0] | 0) - (d[n + 4 >> 0] | 0) + ((d[n + 3 >> 0] | 0) + (d[n + -2 >> 0] | 0) << 2) + v + (((d[k >> 0] | 0) + (d[n >> 0] | 0) | 0) * 40 | 0) >> 6;
                        if ((n | 0) < 0) n = 0;
                        else n = ((n | 0) > (c | 0) ? c : n) & 255;
                        a[m + 1 >> 0] = n;
                        e = e + -2 | 0;
                        if ((e | 0) <= 1) break;
                        else m = m + 2 | 0
                    }
                    b = b + (l + 2) | 0;
                    e = f - l | 0;
                    k = h + (g + 4) | 0
                }
                if (!e) {
                    i = j;
                    return
                }
                a[b >> 0] = a[k >> 0] | 0;
                i = j;
                return
            }
            q = d[h >> 0] | 0;
            r = d[h + 1 >> 0] | 0;
            m = d[h + 2 >> 0] | 0;
            p = d[k >> 0] | 0;
            o = d[h + 4 >> 0] | 0;
            n = d[h + 5 >> 0] | 0;
            if ((e | 0) > 1) {
                f = e + -2 | 0;
                g = f >>> 1;
                l = g << 1;
                t = b;
                while (1) {
                    s = d[k + 3 >> 0] | 0;
                    u = p * 57 | 0;
                    v = (n << 2) + 32 + ($(o, -10) | 0) + u + (m * 18 | 0) + ($(r, -6) | 0) + (q << 1) - s >> 6;
                    if ((v | 0) < 0) v = 0;
                    else v = ((v | 0) > (c | 0) ? c : v) & 255;
                    a[t >> 0] = v;
                    q = ($(n, -6) | 0) + 32 + (o * 18 | 0) + u + ($(m, -10) | 0) - q + (r << 2) + (s << 1) >> 6;
                    if ((q | 0) < 0) q = 0;
                    else q = ((q | 0) > (c | 0) ? c : q) & 255;
                    a[t + 1 >> 0] = q;
                    e = e + -2 | 0;
                    if ((e | 0) <= 1) break;
                    else {
                        x = n;
                        w = o;
                        u = p;
                        v = m;
                        q = r;
                        n = s;
                        t = t + 2 | 0;
                        k = k + 1 | 0;
                        o = x;
                        p = w;
                        m = u;
                        r = v
                    }
                }
                q = r;
                r = m;
                m = p;
                p = o;
                o = n;
                n = s;
                b = b + (l + 2) | 0;
                e = f - l | 0;
                k = h + (g + 4) | 0
            }
            if (!e) {
                i = j;
                return
            }
            h = (n << 2) + 32 + ($(o, -10) | 0) + (p * 57 | 0) + (m * 18 | 0) + ($(r, -6) | 0) + (q << 1) - (d[k + 3 >> 0] | 0) >> 6;
            if ((h | 0) < 0) h = 0;
            else h = ((h | 0) > (c | 0) ? c : h) & 255;
            a[b >> 0] = h;
            i = j;
            return
        }

        function Oe() {
            var a = 0,
                b = 0;
            a = i;
            b = le(252) | 0;
            if (!b) b = 0;
            i = a;
            return b | 0
        }

        function Pe(d, e, f) {
            d = d | 0;
            e = e | 0;
            f = f | 0;
            var g = 0,
                h = 0,
                j = 0,
                k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0,
                B = 0,
                C = 0,
                D = 0,
                E = 0,
                F = 0,
                G = 0,
                H = 0,
                I = 0,
                J = 0,
                K = 0,
                L = 0,
                M = 0,
                N = 0,
                O = 0,
                P = 0,
                Q = 0,
                R = 0;
            g = i;
            i = i + 80 | 0;
            h = g + 64 | 0;
            j = g + 52 | 0;
            u = g + 48 | 0;
            s = g + 44 | 0;
            r = g + 40 | 0;
            w = g + 36 | 0;
            n = g;
            y = a[d + 40 >> 0] | 0;
            a: do
                if (((((((f | 0) >= 6 ? (a[e >> 0] | 0) == 66 : 0) ? (a[e + 1 >> 0] | 0) == 80 : 0) ? (a[e + 2 >> 0] | 0) == 71 : 0) ? (a[e + 3 >> 0] | 0) == -5 : 0) ? (R = a[e + 4 >> 0] | 0, P = R & 255, z = P >>> 5, c[n + 8 >> 2] = z, (R & 255) <= 191) : 0) ? (R = (P & 15) + 8 | 0, a[n + 13 >> 0] = R, (R & 255) >>> 0 <= 14) : 0) {
                    H = a[e + 5 >> 0] | 0;
                    v = H & 255;
                    I = v >>> 4;
                    c[n + 24 >> 2] = I;
                    A = v & 8;
                    N = v >>> 2 & 1;
                    a[n + 16 >> 0] = v >>> 1 & 1;
                    p = n + 17 | 0;
                    a[p >> 0] = v & 1;
                    v = n + 18 | 0;
                    b[v >> 1] = 0;
                    q = n + 20 | 0;
                    b[q >> 1] = 0;
                    t = n + 22 | 0;
                    b[t >> 1] = 0;
                    Q = n + 12 | 0;
                    a[Q >> 0] = 0;
                    R = n + 14 | 0;
                    a[R >> 0] = 0;
                    O = n + 15 | 0;
                    a[O >> 0] = 0;
                    if (!(P & 16))
                        if (!N) N = 0;
                        else {
                            a[Q >> 0] = 1;
                            a[R >> 0] = 1;
                            N = 1
                        } else {
                        a[Q >> 0] = 1;
                        a[O >> 0] = N;
                        N = 0
                    }
                    if ((((((((((H & 255) <= 79 ? (z | 0) != 0 | (I | 0) == 0 : 0) ? !(N << 24 >> 24 != 0 & (z | 0) == 0) : 0) ? (G = We(n, e + 6 | 0, f + -6 | 0) | 0, (G | 0) >= 0) : 0) ? (F = (c[n >> 2] | 0) >>> 0 > 1073741823 ? -1 : G, (F | 0) >= 0) : 0) ? (L = F + 6 | 0, J = n + 4 | 0, E = We(J, e + L | 0, f - L | 0) | 0, (E | 0) >= 0) : 0) ? (B = c[J >> 2] | 0, K = B >>> 0 > 1073741823 ? -1 : E, (K | 0) >= 0) : 0) ? (C = K + L | 0, !((c[n >> 2] | 0) == 0 | (B | 0) == 0)) : 0) ? (o = n + 28 | 0, D = We(o, e + C | 0, f - C | 0) | 0, (D | 0) >= 0) : 0) ? (M = (c[o >> 2] | 0) >>> 0 > 1073741823 ? -1 : D, (M | 0) >= 0) : 0) {
                        z = M + C | 0;
                        c[h >> 2] = 0;
                        do
                            if (!A) {
                                c[n + 32 >> 2] = 0;
                                x = 48
                            } else {
                                A = We(h, e + z | 0, f - z | 0) | 0;
                                if ((A | 0) < 0) {
                                    z = -1;
                                    break a
                                }
                                C = c[h >> 2] | 0;
                                A = C >>> 0 > 1073741823 ? -1 : A;
                                if ((A | 0) < 0) {
                                    z = -1;
                                    break a
                                }
                                B = A + z | 0;
                                A = n + 32 | 0;
                                c[A >> 2] = 0;
                                z = B + C | 0;
                                if ((z | 0) > (f | 0)) {
                                    z = -1;
                                    break a
                                }
                                y = y << 24 >> 24 != 0;
                                if (!y ? (a[p >> 0] | 0) == 0 : 0) break;
                                if ((B | 0) < (z | 0)) x = A;
                                else {
                                    z = B;
                                    x = 48;
                                    break
                                }
                                while (1) {
                                    A = We(j, e + B | 0, z - B | 0) | 0;
                                    if ((A | 0) < 0) {
                                        z = -1;
                                        break a
                                    }
                                    B = A + B | 0;
                                    C = We(u, e + B | 0, z - B | 0) | 0;
                                    if ((C | 0) < 0) {
                                        z = -1;
                                        break a
                                    }
                                    A = c[u >> 2] | 0;
                                    C = A >>> 0 > 1073741823 ? -1 : C;
                                    if ((C | 0) < 0) {
                                        z = -1;
                                        break a
                                    }
                                    C = C + B | 0;
                                    B = C + A | 0;
                                    if (B >>> 0 > z >>> 0) {
                                        z = -1;
                                        break a
                                    }
                                    do
                                        if (a[p >> 0] | 0) {
                                            if ((c[j >> 2] | 0) != 5) break;
                                            E = We(s, e + C | 0, z - C | 0) | 0;
                                            if ((E | 0) < 0) {
                                                z = -1;
                                                break a
                                            }
                                            D = c[s >> 2] | 0;
                                            E = D >>> 0 > 1073741823 ? -1 : E;
                                            if ((E | 0) < 0) {
                                                z = -1;
                                                break a
                                            }
                                            F = E + C | 0;
                                            G = We(r, e + F | 0, z - F | 0) | 0;
                                            if ((G | 0) < 0) {
                                                z = -1;
                                                break a
                                            }
                                            E = c[r >> 2] | 0;
                                            G = E >>> 0 > 1073741823 ? -1 : G;
                                            if ((G | 0) < 0) {
                                                z = -1;
                                                break a
                                            }
                                            R = G + F | 0;
                                            if ((We(w, e + R | 0, z - R | 0) | 0) < 0) {
                                                z = -1;
                                                break a
                                            }
                                            F = c[w >> 2] | 0;
                                            if (!((E & 65535 | 0) == (E | 0) & ((F >>> 0 > 1073741823 | (E | 0) == 0 | (F | 0) == 0) ^ 1))) {
                                                z = -1;
                                                break a
                                            }
                                            if ((F & 65535 | 0) != (F | 0)) {
                                                z = -1;
                                                break a
                                            }
                                            if ((D & 65535 | 0) != (D | 0)) {
                                                z = -1;
                                                break a
                                            }
                                            b[v >> 1] = D;
                                            b[q >> 1] = E;
                                            b[t >> 1] = F
                                        }
                                    while (0);
                                    if (y) {
                                        P = ee(16) | 0;
                                        c[P >> 2] = c[j >> 2];
                                        Q = P + 4 | 0;
                                        c[Q >> 2] = A;
                                        R = P + 12 | 0;
                                        c[R >> 2] = 0;
                                        c[x >> 2] = P;
                                        x = ee(A) | 0;
                                        c[P + 8 >> 2] = x;
                                        mf(x | 0, e + C | 0, c[Q >> 2] | 0) | 0;
                                        x = R
                                    }
                                    if ((B | 0) >= (z | 0)) {
                                        z = B;
                                        x = 48;
                                        break
                                    }
                                }
                            }
                        while (0);
                        do
                            if ((x | 0) == 48) {
                                if (!(a[p >> 0] | 0)) break;
                                if (!(b[q >> 1] | 0)) {
                                    z = -1;
                                    break a
                                }
                            }
                        while (0);
                        if (c[o >> 2] | 0) break;
                        c[o >> 2] = f - z
                    } else z = -1
                } else z = -1;
            while (0);
            if ((z | 0) < 0) {
                R = z;
                i = g;
                return R | 0
            }
            q = c[n >> 2] | 0;
            r = c[n + 4 >> 2] | 0;
            u = c[n + 12 >> 2] | 0;
            v = u & 255;
            w = c[n + 24 >> 2] | 0;
            s = (u & 65535) >>> 8;
            x = s & 255;
            s = s & 65535;
            o = d + 16 | 0;
            c[o >> 2] = q;
            p = d + 20 | 0;
            c[p >> 2] = r;
            t = c[n + 8 >> 2] | 0;
            A = d + 24 | 0;
            c[A >> 2] = t;
            y = u >>> 24 & 255;
            u = u >>> 16 & 255;
            if ((t | 0) == 5) {
                c[A >> 2] = 2;
                a[d + 28 >> 0] = 0;
                t = 2
            } else if ((t | 0) == 4) {
                c[A >> 2] = 1;
                a[d + 28 >> 0] = 0;
                t = 1
            } else {
                c[A >> 2] = t;
                a[d + 28 >> 0] = 1
            }
            a[d + 29 >> 0] = v;
            a[d + 33 >> 0] = y;
            a[d + 31 >> 0] = u;
            u = c[n + 16 >> 2] | 0;
            a[d + 32 >> 0] = u;
            c[d + 36 >> 2] = w;
            a[d + 30 >> 0] = x;
            w = d + 34 | 0;
            a[w >> 0] = (u & 65535) >>> 8;
            b[d + 48 >> 1] = u >>> 16;
            u = c[n + 20 >> 2] | 0;
            b[d + 50 >> 1] = u;
            b[d + 52 >> 1] = u >>> 16;
            u = d + 44 | 0;
            c[u >> 2] = c[n + 32 >> 2];
            do
                if (((c[n + 28 >> 2] | 0) + z | 0) >>> 0 <= f >>> 0) {
                    x = e + z | 0;
                    n = f - z | 0;
                    c[h >> 2] = 0;
                    c[h + 4 >> 2] = 0;
                    c[h + 8 >> 2] = 0;
                    c[j >> 2] = 0;
                    c[j + 4 >> 2] = 0;
                    c[j + 8 >> 2] = 0;
                    if (!(v << 24 >> 24)) y = n;
                    else {
                        v = Se(h, d + 12 | 0, d + 4 | 0, x, n, q, r, 0, s) | 0;
                        if ((v | 0) < 0) break;
                        x = e + (v + z) | 0;
                        y = n - v | 0
                    }
                    v = d + 8 | 0;
                    q = Se(j, v, d, x, y, q, r, t, s) | 0;
                    if (((q | 0) >= 0 ? (l = y - q | 0, k = Te(d, h, j, x + q | 0, l, 1) | 0, he(c[h >> 2] | 0), he(c[j >> 2] | 0), (k | 0) >= 0) : 0) ? (m = k + (n - l) | 0, (m | 0) >= 0) : 0) {
                        h = m + z | 0;
                        a[d + 41 >> 0] = 1;
                        if (!(a[w >> 0] | 0)) Qe(d);
                        else {
                            j = f - h | 0;
                            f = ee(j) | 0;
                            c[d + 56 >> 2] = f;
                            if (!f) break;
                            mf(f | 0, e + h | 0, j | 0) | 0;
                            c[d + 64 >> 2] = j;
                            c[d + 60 >> 2] = 0
                        }
                        R = c[v >> 2] | 0;
                        if ((c[R + 64 >> 2] | 0) >= (c[o >> 2] | 0) ? (c[R + 68 >> 2] | 0) >= (c[p >> 2] | 0) : 0) {
                            c[d + 80 >> 2] = -1;
                            R = 0;
                            i = g;
                            return R | 0
                        }
                    }
                }
            while (0);
            Ce(d + 8 | 0);
            Ce(d + 12 | 0);
            c[u >> 2] = 0;
            R = -1;
            i = g;
            return R | 0
        }

        function Qe(a) {
            a = a | 0;
            var b = 0,
                d = 0,
                e = 0;
            b = i;
            d = a + 4 | 0;
            e = c[d >> 2] | 0;
            if (e) {
                Fd(e) | 0;
                he(c[d >> 2] | 0);
                c[d >> 2] = 0
            }
            d = c[a >> 2] | 0;
            if (!d) {
                i = b;
                return
            }
            Fd(d) | 0;
            he(c[a >> 2] | 0);
            c[a >> 2] = 0;
            i = b;
            return
        }

        function Re(a) {
            a = a | 0;
            var b = 0,
                d = 0;
            b = i;
            he(c[a + 124 >> 2] | 0);
            he(c[a + 128 >> 2] | 0);
            d = 0;
            do {
                he(c[a + (d << 2) + 132 >> 2] | 0);
                he(c[a + (d << 2) + 164 >> 2] | 0);
                d = d + 1 | 0
            } while ((d | 0) != 8);
            he(c[a + 196 >> 2] | 0);
            he(c[a + 56 >> 2] | 0);
            Qe(a);
            Ce(a + 8 | 0);
            Ce(a + 12 | 0);
            he(a);
            i = b;
            return
        }

        function Se(b, d, e, f, g, h, j, k, l) {
            b = b | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            var m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0;
            n = i;
            i = i + 16 | 0;
            q = n + 4 | 0;
            m = n;
            p = We(q, f, g) | 0;
            if ((p | 0) < 0) {
                t = -1;
                i = n;
                return t | 0
            }
            r = c[q >> 2] | 0;
            t = r >>> 0 > 1073741823 ? -1 : p;
            if ((t | 0) < 0) {
                t = -1;
                i = n;
                return t | 0
            }
            s = g - t | 0;
            if (r >>> 0 > s >>> 0) {
                t = -1;
                i = n;
                return t | 0
            }
            q = r + 10 | 0;
            p = ee(q) | 0;
            a[p >> 0] = k;
            a[p + 1 >> 0] = h >>> 24;
            a[p + 2 >> 0] = h >>> 16;
            a[p + 3 >> 0] = h >>> 8;
            a[p + 4 >> 0] = h;
            a[p + 5 >> 0] = j >>> 24;
            a[p + 6 >> 0] = j >>> 16;
            a[p + 7 >> 0] = j >>> 8;
            a[p + 8 >> 0] = j;
            a[p + 9 >> 0] = l + 248;
            mf(p + 10 | 0, f + t | 0, r | 0) | 0;
            l = s - r | 0;
            k = ee(10 - r + (q << 1) + l | 0) | 0;
            a[k >> 0] = 0;
            a[k + 1 >> 0] = 0;
            a[k + 2 >> 0] = 0;
            a[k + 3 >> 0] = 1;
            a[k + 4 >> 0] = 96;
            a[k + 5 >> 0] = 1;
            if ((q | 0) > 0) {
                r = 0;
                f = 6;
                do {
                    j = r + 1 | 0;
                    h = a[p + r >> 0] | 0;
                    if ((j | 0) < (q | 0) & h << 24 >> 24 == 0)
                        if (!(a[p + j >> 0] | 0)) {
                            a[k + f >> 0] = 0;
                            a[k + (f + 1) >> 0] = 0;
                            a[k + (f + 2) >> 0] = 3;
                            r = r + 2 | 0;
                            f = f + 3 | 0
                        } else {
                            h = 0;
                            o = 8
                        } else o = 8;
                    if ((o | 0) == 8) {
                        o = 0;
                        a[k + f >> 0] = h;
                        r = j;
                        f = f + 1 | 0
                    }
                } while ((r | 0) < (q | 0));
                if (!f) {
                    f = 0;
                    o = 12
                } else o = 11
            } else {
                f = 6;
                o = 11
            }
            if ((o | 0) == 11)
                if (!(a[k + (f + -1) >> 0] | 0)) o = 12;
            if ((o | 0) == 12) {
                a[k + f >> 0] = -128;
                f = f + 1 | 0
            }
            he(p);
            o = g - l | 0;
            if ((o | 0) < 0) {
                t = -1;
                i = n;
                return t | 0
            }
            g = b + 8 | 0;
            if ((Ue(b, (c[g >> 2] | 0) + f | 0) | 0) < 0) {
                he(k);
                t = -1;
                i = n;
                return t | 0
            }
            mf((c[b >> 2] | 0) + (c[g >> 2] | 0) | 0, k | 0, f | 0) | 0;
            c[g >> 2] = (c[g >> 2] | 0) + f;
            he(k);
            b = Kd(1488) | 0;
            if (!b) {
                t = -1;
                i = n;
                return t | 0
            }
            g = Be() | 0;
            c[m >> 2] = g;
            if (!g) {
                t = -1;
                i = n;
                return t | 0
            }
            t = b + 688 | 0;
            c[t >> 2] = c[t >> 2] | 1;
            if ((Ed(b, 1488, 0) | 0) < 0) {
                Ce(m);
                t = -1;
                i = n;
                return t | 0
            } else {
                c[e >> 2] = b;
                c[d >> 2] = g;
                t = o;
                i = n;
                return t | 0
            }
            return 0
        }

        function Te(b, e, f, g, h, j) {
            b = b | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            var k = 0,
                l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0,
                y = 0,
                z = 0,
                A = 0;
            k = i;
            i = i + 16 | 0;
            p = k;
            l = b + 4 | 0;
            n = (c[l >> 2] | 0) != 0;
            c[p >> 2] = 0;
            o = p + 4 | 0;
            c[o >> 2] = 0;
            a: do
                if ((h | 0) > 0) {
                    q = p + ((n & 1) << 2) | 0;
                    t = 0;
                    x = 0;
                    r = h;
                    w = (j | 0) != 0;
                    b: while (1) {
                        if ((r | 0) < ((w ? 5 : 2) | 0)) {
                            m = 48;
                            break
                        }
                        if (w) v = 0;
                        else v = (a[g + 2 >> 0] | 0) == 0 ? 4 : 3;
                        if ((r | 0) < (v + 3 | 0)) {
                            m = 48;
                            break
                        }
                        s = g + v | 0;
                        j = d[s >> 0] | 0;
                        u = j << 5 & 32 | (d[g + (v + 1) >> 0] | 0) >>> 3;
                        j = j >>> 1 & 63;
                        do
                            if ((j + -32 | 0) >>> 0 < 4 | (j | 0) == 39 | j >>> 0 > 40)
                                if (t)
                                    if (!(c[q >> 2] | 0)) j = x;
                                    else break a;
                        else {
                            j = x;
                            t = 0
                        } else if ((j >>> 0 < 10 | (j + -16 | 0) >>> 0 < 6 ? (m = v + 2 | 0, (m | 0) < (r | 0)) : 0) ? (a[g + m >> 0] | 0) < 0 : 0) {
                            if ((x | 0) != 0 ? (c[q >> 2] | 0) != 0 : 0) break a;
                            if (n & (u | 0) == 1) {
                                c[o >> 2] = 1;
                                j = x;
                                t = x;
                                break
                            } else {
                                c[p >> 2] = 1;
                                j = 1;
                                t = 1;
                                break
                            }
                        } else j = x;
                        while (0);
                        do
                            if (!w) {
                                if (((((r | 0) > 3 ? (a[g >> 0] | 0) == 0 : 0) ? (a[g + 1 >> 0] | 0) == 0 : 0) ? (a[g + 2 >> 0] | 0) == 0 : 0) ? (a[g + 3 >> 0] | 0) == 1 : 0) {
                                    w = 4;
                                    break
                                }
                                if ((r | 0) <= 2) {
                                    m = 48;
                                    break b
                                }
                                if (a[g >> 0] | 0) {
                                    m = 48;
                                    break b
                                }
                                if (a[g + 1 >> 0] | 0) {
                                    m = 48;
                                    break b
                                }
                                if ((a[g + 2 >> 0] | 0) == 1) w = 3;
                                else {
                                    m = 48;
                                    break b
                                }
                            } else w = 0;
                        while (0);
                        x = w + 2 | 0;
                        if ((x | 0) > (r | 0)) {
                            m = 48;
                            break
                        }
                        c: do
                            if ((x | 0) < (r | 0))
                                while (1) {
                                    z = (a[g + w >> 0] | 0) == 0;
                                    if ((z ? (a[g + (w + 1) >> 0] | 0) == 0 : 0) ? (a[g + x >> 0] | 0) == 1 : 0) break c;
                                    A = x;
                                    x = w + 3 | 0;
                                    if ((x | 0) >= (r | 0)) {
                                        w = r;
                                        break c
                                    }
                                    y = w + 1 | 0;
                                    if (!z) {
                                        w = y;
                                        continue
                                    }
                                    if (a[g + y >> 0] | 0) {
                                        w = y;
                                        continue
                                    }
                                    if (a[g + A >> 0] | 0) {
                                        w = y;
                                        continue
                                    }
                                    z = (a[g + x >> 0] | 0) == 1;
                                    if (z) {
                                        w = z ? w : r;
                                        break
                                    } else w = y
                                } else w = r;
                        while (0);
                        if ((w | 0) < 0) {
                            m = 48;
                            break
                        }
                        v = w - v | 0;
                        x = v + 3 | 0;
                        u = n & (u | 0) == 1;
                        z = u ? e : f;
                        y = z + 8 | 0;
                        if ((Ue(z, (c[y >> 2] | 0) + x | 0) | 0) < 0) {
                            m = 48;
                            break
                        }
                        A = c[z >> 2] | 0;
                        z = c[y >> 2] | 0;
                        a[A + z >> 0] = 0;
                        a[A + (z + 1) >> 0] = 0;
                        a[A + (z + 2) >> 0] = 1;
                        mf(A + (z + 3) | 0, s | 0, v | 0) | 0;
                        if (u) {
                            A = A + (z + 4) | 0;
                            a[A >> 0] = d[A >> 0] & 7
                        }
                        c[y >> 2] = (c[y >> 2] | 0) + x;
                        r = r - w | 0;
                        if ((r | 0) > 0) {
                            x = j;
                            g = g + w | 0;
                            w = 0
                        } else break a
                    }
                    if ((m | 0) == 48) {
                        i = k;
                        return -1
                    }
                } else r = h;
            while (0);
            if (c[l >> 2] | 0) {
                m = e + 8 | 0;
                if ((Ue(e, (c[m >> 2] | 0) + 32 | 0) | 0) < 0) {
                    i = k;
                    return -1
                }
                if ((Ve(c[l >> 2] | 0, c[b + 12 >> 2] | 0, c[e >> 2] | 0, c[m >> 2] | 0) | 0) < 0) {
                    i = k;
                    return -1
                }
            }
            l = f + 8 | 0;
            if ((Ue(f, (c[l >> 2] | 0) + 32 | 0) | 0) < 0) {
                i = k;
                return -1
            } else {
                A = (Ve(c[b >> 2] | 0, c[b + 8 >> 2] | 0, c[f >> 2] | 0, c[l >> 2] | 0) | 0) < 0;
                i = k;
                return (A ? -1 : h - r | 0) | 0
            }
            return 0
        }

        function Ue(a, b) {
            a = a | 0;
            b = b | 0;
            var d = 0,
                e = 0,
                f = 0;
            d = i;
            e = a + 4 | 0;
            f = c[e >> 2] | 0;
            if ((f | 0) < (b | 0)) {
                f = (f * 3 | 0) / 2 | 0;
                f = (f | 0) < (b | 0) ? b : f;
                b = fe(c[a >> 2] | 0, f) | 0;
                if (!b) a = -1;
                else {
                    c[a >> 2] = b;
                    c[e >> 2] = f;
                    a = 0
                }
            } else a = 0;
            i = d;
            return a | 0
        }

        function Ve(b, d, e, f) {
            b = b | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            var g = 0,
                h = 0,
                j = 0;
            j = i;
            i = i + 96 | 0;
            h = j;
            g = j + 80 | 0;
            Ud(h);
            c[h + 24 >> 2] = e;
            c[h + 28 >> 2] = f;
            e = e + f + 0 | 0;
            f = e + 32 | 0;
            do {
                a[e >> 0] = 0;
                e = e + 1 | 0
            } while ((e | 0) < (f | 0));
            e = (Ld(b, d, g, h) | 0) < 0;
            i = j;
            return (e | (c[g >> 2] | 0) == 0) << 31 >> 31 | 0
        }

        function We(b, e, f) {
            b = b | 0;
            e = e | 0;
            f = f | 0;
            var g = 0,
                h = 0,
                j = 0,
                k = 0;
            g = i;
            a: do
                if ((f | 0) >= 1) {
                    j = a[e >> 0] | 0;
                    h = j & 255;
                    if (j << 24 >> 24 > -1) {
                        c[b >> 2] = h;
                        b = 1;
                        break
                    }
                    if (j << 24 >> 24 != -128) {
                        j = e + 1 | 0;
                        h = h & 127;
                        while (1) {
                            if ((f | 0) < 2) {
                                b = -1;
                                break a
                            }
                            k = j;
                            j = j + 1 | 0;
                            k = d[k >> 0] | 0;
                            h = k & 127 | h << 7;
                            if (!(k & 128)) break;
                            else f = f + -1 | 0
                        }
                        c[b >> 2] = h;
                        b = j - e | 0
                    } else b = -1
                } else b = -1;
            while (0);
            i = g;
            return b | 0
        }

        function Xe(b, e, f, g, h, j, k) {
            b = b | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            var l = 0,
                m = 0,
                n = 0;
            h = i;
            if ((c[b + 40 >> 2] | 0) == 8 ? (c[b + 44 >> 2] | 0) == 0 : 0) {
                if ((j | 0) > 0) g = 0;
                else {
                    i = h;
                    return
                }
                while (1) {
                    n = a[f + g >> 0] | 0;
                    a[e >> 0] = n;
                    a[e + 1 >> 0] = n;
                    a[e + 2 >> 0] = n;
                    g = g + 1 | 0;
                    if ((g | 0) == (j | 0)) break;
                    else e = e + k | 0
                }
                i = h;
                return
            }
            l = c[b + 12 >> 2] | 0;
            g = c[b + 16 >> 2] | 0;
            b = c[b >> 2] | 0;
            if ((j | 0) > 0) m = 0;
            else {
                i = h;
                return
            }
            while (1) {
                n = ($(d[f + m >> 0] | 0, l) | 0) + g >> b;
                if ((n | 0) < 0) n = 0;
                else n = (n | 0) > 255 ? -1 : n & 255;
                a[e >> 0] = n;
                a[e + 1 >> 0] = n;
                a[e + 2 >> 0] = n;
                m = m + 1 | 0;
                if ((m | 0) == (j | 0)) break;
                else e = e + k | 0
            }
            i = h;
            return
        }

        function Ye(b, e, f, g, h, j, k) {
            b = b | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            var l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0,
                v = 0,
                w = 0,
                x = 0;
            q = i;
            s = c[b + 20 >> 2] | 0;
            n = c[b + 24 >> 2] | 0;
            o = c[b + 28 >> 2] | 0;
            l = c[b + 32 >> 2] | 0;
            p = c[b + 12 >> 2] | 0;
            r = c[b + 16 >> 2] | 0;
            m = c[b >> 2] | 0;
            b = c[b + 36 >> 2] | 0;
            if ((j | 0) > 0) t = 0;
            else {
                i = q;
                return
            }
            while (1) {
                v = $(d[f + t >> 0] | 0, p) | 0;
                u = (d[g + t >> 0] | 0) - b | 0;
                w = (d[h + t >> 0] | 0) - b | 0;
                v = v + r | 0;
                x = v + ($(w, s) | 0) >> m;
                if ((x | 0) < 0) x = 0;
                else x = (x | 0) > 255 ? -1 : x & 255;
                a[e >> 0] = x;
                w = v - ($(u, n) | 0) - ($(w, o) | 0) >> m;
                if ((w | 0) < 0) w = 0;
                else w = (w | 0) > 255 ? -1 : w & 255;
                a[e + 1 >> 0] = w;
                u = v + ($(u, l) | 0) >> m;
                if ((u | 0) < 0) u = 0;
                else u = (u | 0) > 255 ? -1 : u & 255;
                a[e + 2 >> 0] = u;
                t = t + 1 | 0;
                if ((t | 0) == (j | 0)) break;
                else e = e + k | 0
            }
            i = q;
            return
        }

        function Ze(b, e, f, g, h, j, k) {
            b = b | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            var l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0;
            l = i;
            if ((c[b + 40 >> 2] | 0) == 8 ? (c[b + 44 >> 2] | 0) == 0 : 0) {
                if ((j | 0) > 0) m = 0;
                else {
                    i = l;
                    return
                }
                while (1) {
                    a[e >> 0] = a[h + m >> 0] | 0;
                    a[e + 1 >> 0] = a[f + m >> 0] | 0;
                    a[e + 2 >> 0] = a[g + m >> 0] | 0;
                    m = m + 1 | 0;
                    if ((m | 0) == (j | 0)) break;
                    else e = e + k | 0
                }
                i = l;
                return
            }
            n = c[b + 12 >> 2] | 0;
            m = c[b + 16 >> 2] | 0;
            b = c[b >> 2] | 0;
            if ((j | 0) > 0) o = 0;
            else {
                i = l;
                return
            }
            while (1) {
                p = ($(d[h + o >> 0] | 0, n) | 0) + m >> b;
                if ((p | 0) < 0) p = 0;
                else p = (p | 0) > 255 ? -1 : p & 255;
                a[e >> 0] = p;
                p = ($(d[f + o >> 0] | 0, n) | 0) + m >> b;
                if ((p | 0) < 0) p = 0;
                else p = (p | 0) > 255 ? -1 : p & 255;
                a[e + 1 >> 0] = p;
                p = ($(d[g + o >> 0] | 0, n) | 0) + m >> b;
                if ((p | 0) < 0) p = 0;
                else p = (p | 0) > 255 ? -1 : p & 255;
                a[e + 2 >> 0] = p;
                o = o + 1 | 0;
                if ((o | 0) == (j | 0)) break;
                else e = e + k | 0
            }
            i = l;
            return
        }

        function _e(b, e, f, g, h, j, k) {
            b = b | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            j = j | 0;
            k = k | 0;
            var l = 0,
                m = 0,
                n = 0,
                o = 0,
                p = 0,
                q = 0,
                r = 0,
                s = 0,
                t = 0,
                u = 0;
            o = i;
            l = c[b + 12 >> 2] | 0;
            m = c[b + 16 >> 2] | 0;
            n = c[b >> 2] | 0;
            b = c[b + 36 >> 2] | 0;
            if ((j | 0) > 0) p = 0;
            else {
                i = o;
                return
            }
            while (1) {
                t = d[f + p >> 0] | 0;
                s = (d[g + p >> 0] | 0) - b | 0;
                r = (d[h + p >> 0] | 0) - b | 0;
                q = t - s | 0;
                u = ($(q + r | 0, l) | 0) + m >> n;
                if ((u | 0) < 0) u = 0;
                else u = (u | 0) > 255 ? -1 : u & 255;
                a[e >> 0] = u;
                s = ($(s + t | 0, l) | 0) + m >> n;
                if ((s | 0) < 0) s = 0;
                else s = (s | 0) > 255 ? -1 : s & 255;
                a[e + 1 >> 0] = s;
                q = ($(q - r | 0, l) | 0) + m >> n;
                if ((q | 0) < 0) q = 0;
                else q = (q | 0) > 255 ? -1 : q & 255;
                a[e + 2 >> 0] = q;
                p = p + 1 | 0;
                if ((p | 0) == (j | 0)) break;
                else e = e + k | 0
            }
            i = o;
            return
        }

        function $e(b) {
            b = b | 0;
            var d = 0,
                e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0,
                k = 0;
            d = i;
            if ((b | 0) == 0 | b >>> 0 > 2147483583) {
                k = 0;
                i = d;
                return k | 0
            }
            do
                if (!(c[1571] | 0)) {
                    e = ua(64) | 0;
                    if ((e | 0) == (-1 | 0)) {
                        k = 0;
                        i = d;
                        return k | 0
                    } else {
                        c[1572] = ua(0) | 0;
                        c[1571] = 6280;
                        c[1570] = 6280;
                        c[1575] = 6296;
                        c[1574] = 6296;
                        k = e + 16 | 0;
                        a[e + 15 >> 0] = -86;
                        j = c[1575] | 0;
                        c[1575] = k;
                        c[k >> 2] = 6296;
                        c[e + 20 >> 2] = j;
                        c[j >> 2] = k;
                        j = e + 24 | 0;
                        k = c[1571] | 0;
                        c[1571] = j;
                        c[j >> 2] = 6280;
                        c[e + 28 >> 2] = k;
                        c[k >> 2] = j;
                        break
                    }
                }
            while (0);
            e = b + 40 & -32;
            h = c[1572] | 0;
            g = c[1570] | 0;
            k = 6284 | 0;
            while (1) {
                f = c[k >> 2] | 0;
                b = f + -8 | 0;
                k = c[f + -4 >> 2] | 0;
                if ((k | 0) == 6296) j = h;
                else j = k;
                j = j - b | 0;
                if (e >>> 0 < j >>> 0) {
                    h = 12;
                    break
                }
                if ((f | 0) == (g | 0)) {
                    h = 10;
                    break
                }
                k = f + 4 | 0;
                if ((e | 0) == (j | 0)) {
                    h = 15;
                    break
                }
            }
            do
                if ((h | 0) == 10)
                    if ((ua(e + 32 - j | 0) | 0) == (-1 | 0)) {
                        k = 0;
                        i = d;
                        return k | 0
                    } else {
                        c[1572] = ua(0) | 0;
                        k = c[g + -4 >> 2] | 0;
                        f = g;
                        h = 12;
                        break
                    } else
            if ((h | 0) == 15) {
                j = c[f >> 2] | 0;
                k = c[k >> 2] | 0;
                c[j + 4 >> 2] = k;
                c[k >> 2] = j
            }
            while (0);
            if ((h | 0) == 12) {
                h = b + e | 0;
                c[f + -4 >> 2] = h;
                c[h >> 2] = b;
                c[b + (e | 4) >> 2] = k;
                c[k >> 2] = h;
                h = b + (e | 8) | 0;
                k = f + 4 | 0;
                j = c[k >> 2] | 0;
                c[k >> 2] = h;
                c[h >> 2] = f;
                c[b + (e | 12) >> 2] = j;
                c[j >> 2] = h;
                a[b + (e + -1) >> 0] = -86;
                j = c[f >> 2] | 0;
                k = c[k >> 2] | 0;
                c[j + 4 >> 2] = k;
                c[k >> 2] = j
            }
            a[b + -1 >> 0] = 85;
            k = f;
            i = d;
            return k | 0
        }

        function af(b) {
            b = b | 0;
            var d = 0,
                e = 0,
                f = 0,
                g = 0,
                h = 0,
                j = 0;
            d = i;
            if (!b) {
                i = d;
                return
            }
            g = b + -8 | 0;
            e = c[1571] | 0;
            c[1571] = b;
            c[b >> 2] = 6280;
            f = b + 4 | 0;
            c[f >> 2] = e;
            c[e >> 2] = b;
            a[b + -9 >> 0] = -86;
            e = c[g >> 2] | 0;
            if ((e | 0) != 6296 ? (a[e + -1 >> 0] | 0) == -86 : 0) {
                g = c[b + -4 >> 2] | 0;
                c[e + 4 >> 2] = g;
                c[g >> 2] = e;
                b = c[b >> 2] | 0;
                g = c[f >> 2] | 0;
                c[b + 4 >> 2] = g;
                c[g >> 2] = b
            } else e = g;
            b = c[e + 4 >> 2] | 0;
            if ((b | 0) == 6296) {
                i = d;
                return
            }
            if ((a[b + -1 >> 0] | 0) != -86) {
                i = d;
                return
            }
            g = c[b >> 2] | 0;
            h = c[b + 4 >> 2] | 0;
            c[g + 4 >> 2] = h;
            c[h >> 2] = g;
            h = e + 8 | 0;
            g = c[h >> 2] | 0;
            j = e + 12 | 0;
            f = c[j >> 2] | 0;
            c[g + 4 >> 2] = f;
            c[f >> 2] = g;
            f = b + 8 | 0;
            g = b + 12 | 0;
            e = c[g >> 2] | 0;
            c[g >> 2] = h;
            c[h >> 2] = f;
            c[j >> 2] = e;
            c[e >> 2] = h;
            f = c[f >> 2] | 0;
            g = c[g >> 2] | 0;
            c[f + 4 >> 2] = g;
            c[g >> 2] = f;
            i = d;
            return
        }

        function bf(a, b) {
            a = a | 0;
            b = b | 0;
            var d = 0,
                e = 0,
                f = 0;
            d = i;
            do
                if (a) {
                    if (!b) {
                        af(a);
                        e = 0;
                        break
                    }
                    e = $e(b) | 0;
                    if (!e) e = 0;
                    else {
                        f = (c[a + -4 >> 2] | 0) - a + -1 | 0;
                        mf(e | 0, a | 0, (f >>> 0 > b >>> 0 ? b : f) | 0) | 0;
                        af(a)
                    }
                } else e = $e(b) | 0;
            while (0);
            i = d;
            return e | 0
        }

        function cf(b, c, d) {
            b = b | 0;
            c = c | 0;
            d = d | 0;
            var e = 0,
                f = 0,
                g = 0,
                h = 0;
            f = i;
            if (!d) {
                h = 0;
                i = f;
                return h | 0
            }
            while (1) {
                g = a[b >> 0] | 0;
                h = a[c >> 0] | 0;
                if (g << 24 >> 24 != h << 24 >> 24) break;
                d = d + -1 | 0;
                if (!d) {
                    b = 0;
                    e = 5;
                    break
                } else {
                    b = b + 1 | 0;
                    c = c + 1 | 0
                }
            }
            if ((e | 0) == 5) {
                i = f;
                return b | 0
            }
            h = (g & 255) - (h & 255) | 0;
            i = f;
            return h | 0
        }

        function df() {}

        function ef(a, b, c) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            if ((c | 0) < 32) {
                D = b >> c;
                return a >>> c | (b & (1 << c) - 1) << 32 - c
            }
            D = (b | 0) < 0 ? -1 : 0;
            return b >> c - 32 | 0
        }

        function ff(a, b, c, d) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            b = b - d - (c >>> 0 > a >>> 0 | 0) >>> 0;
            return (D = b, a - c >>> 0 | 0) | 0
        }

        function gf(a, b, c, d) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            c = a + c >>> 0;
            return (D = b + d + (c >>> 0 < a >>> 0 | 0) >>> 0, c | 0) | 0
        }

        function hf(b) {
            b = b | 0;
            var c = 0;
            c = b;
            while (a[c >> 0] | 0) c = c + 1 | 0;
            return c - b | 0
        }

        function jf(b, d, e) {
            b = b | 0;
            d = d | 0;
            e = e | 0;
            var f = 0,
                g = 0,
                h = 0,
                i = 0;
            f = b + e | 0;
            if ((e | 0) >= 20) {
                d = d & 255;
                i = b & 3;
                h = d | d << 8 | d << 16 | d << 24;
                g = f & ~3;
                if (i) {
                    i = b + 4 - i | 0;
                    while ((b | 0) < (i | 0)) {
                        a[b >> 0] = d;
                        b = b + 1 | 0
                    }
                }
                while ((b | 0) < (g | 0)) {
                    c[b >> 2] = h;
                    b = b + 4 | 0
                }
            }
            while ((b | 0) < (f | 0)) {
                a[b >> 0] = d;
                b = b + 1 | 0
            }
            return b - e | 0
        }

        function kf(a, b, c) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            if ((c | 0) < 32) {
                D = b << c | (a & (1 << c) - 1 << 32 - c) >>> 32 - c;
                return a << c
            }
            D = a << c - 32;
            return 0
        }

        function lf(a) {
            a = a | 0;
            return (a & 255) << 24 | (a >> 8 & 255) << 16 | (a >> 16 & 255) << 8 | a >>> 24 | 0
        }

        function mf(b, d, e) {
            b = b | 0;
            d = d | 0;
            e = e | 0;
            var f = 0;
            if ((e | 0) >= 4096) return xa(b | 0, d | 0, e | 0) | 0;
            f = b | 0;
            if ((b & 3) == (d & 3)) {
                while (b & 3) {
                    if (!e) return f | 0;
                    a[b >> 0] = a[d >> 0] | 0;
                    b = b + 1 | 0;
                    d = d + 1 | 0;
                    e = e - 1 | 0
                }
                while ((e | 0) >= 4) {
                    c[b >> 2] = c[d >> 2];
                    b = b + 4 | 0;
                    d = d + 4 | 0;
                    e = e - 4 | 0
                }
            }
            while ((e | 0) > 0) {
                a[b >> 0] = a[d >> 0] | 0;
                b = b + 1 | 0;
                d = d + 1 | 0;
                e = e - 1 | 0
            }
            return f | 0
        }

        function nf(a, b, c) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            if ((c | 0) < 32) {
                D = b >>> c;
                return a >>> c | (b & (1 << c) - 1) << 32 - c
            }
            D = 0;
            return b >>> c - 32 | 0
        }

        function of(b) {
            b = b | 0;
            var c = 0;
            c = a[n + (b >>> 24) >> 0] | 0;
            if ((c | 0) < 8) return c | 0;
            c = a[n + (b >> 16 & 255) >> 0] | 0;
            if ((c | 0) < 8) return c + 8 | 0;
            c = a[n + (b >> 8 & 255) >> 0] | 0;
            if ((c | 0) < 8) return c + 16 | 0;
            return (a[n + (b & 255) >> 0] | 0) + 24 | 0
        }

        function pf(b) {
            b = b | 0;
            var c = 0;
            c = a[m + (b & 255) >> 0] | 0;
            if ((c | 0) < 8) return c | 0;
            c = a[m + (b >> 8 & 255) >> 0] | 0;
            if ((c | 0) < 8) return c + 8 | 0;
            c = a[m + (b >> 16 & 255) >> 0] | 0;
            if ((c | 0) < 8) return c + 16 | 0;
            return (a[m + (b >>> 24) >> 0] | 0) + 24 | 0
        }

        function qf(a, b) {
            a = a | 0;
            b = b | 0;
            var c = 0,
                d = 0,
                e = 0,
                f = 0;
            f = a & 65535;
            d = b & 65535;
            c = $(d, f) | 0;
            e = a >>> 16;
            d = (c >>> 16) + ($(d, e) | 0) | 0;
            b = b >>> 16;
            a = $(b, f) | 0;
            return (D = (d >>> 16) + ($(b, e) | 0) + (((d & 65535) + a | 0) >>> 16) | 0, d + a << 16 | c & 65535 | 0) | 0
        }

        function rf(a, b, c, d) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            var e = 0,
                f = 0;
            e = a;
            f = c;
            a = qf(e, f) | 0;
            c = D;
            return (D = ($(b, f) | 0) + ($(d, e) | 0) + c | c & 0, a | 0 | 0) | 0
        }

        function sf(a, b, c, d) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            return Aa[a & 1](b | 0, c | 0, d | 0) | 0
        }

        function tf(a, b, c, d, e, f, g, h, i, j, k, l) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            i = i | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            Ba[a & 7](b | 0, c | 0, d | 0, e | 0, f | 0, g | 0, h | 0, i | 0, j | 0, k | 0, l | 0)
        }

        function uf(a, b, c, d, e, f, g, h, i, j, k) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            i = i | 0;
            j = j | 0;
            k = k | 0;
            Ca[a & 1](b | 0, c | 0, d | 0, e | 0, f | 0, g | 0, h | 0, i | 0, j | 0, k | 0)
        }

        function vf(a, b, c, d, e, f) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            Da[a & 3](b | 0, c | 0, d | 0, e | 0, f | 0)
        }

        function wf(a, b) {
            a = a | 0;
            b = b | 0;
            Ea[a & 7](b | 0)
        }

        function xf(a, b, c) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            Fa[a & 15](b | 0, c | 0)
        }

        function yf(a, b, c, d, e, f, g) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            return Ga[a & 1](b | 0, c | 0, d | 0, e | 0, f | 0, g | 0) | 0
        }

        function zf(a, b, c, d, e, f, g, h, i, j) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            i = i | 0;
            j = j | 0;
            Ha[a & 1](b | 0, c | 0, d | 0, e | 0, f | 0, g | 0, h | 0, i | 0, j | 0)
        }

        function Af(a, b, c, d, e, f, g, h, i, j, k, l, m) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            i = i | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            m = m | 0;
            Ia[a & 3](b | 0, c | 0, d | 0, e | 0, f | 0, g | 0, h | 0, i | 0, j | 0, k | 0, l | 0, m | 0)
        }

        function Bf(a, b) {
            a = a | 0;
            b = b | 0;
            return Ja[a & 7](b | 0) | 0
        }

        function Cf(a, b, c, d) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            Ka[a & 7](b | 0, c | 0, d | 0)
        }

        function Df(a, b, c, d, e, f, g, h, i) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            i = i | 0;
            La[a & 7](b | 0, c | 0, d | 0, e | 0, f | 0, g | 0, h | 0, i | 0)
        }

        function Ef(a, b, c, d, e) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            return Ma[a & 1](b | 0, c | 0, d | 0, e | 0) | 0
        }

        function Ff(a, b, c, d, e, f, g) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            Na[a & 3](b | 0, c | 0, d | 0, e | 0, f | 0, g | 0)
        }

        function Gf(a, b, c) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            return Oa[a & 1](b | 0, c | 0) | 0
        }

        function Hf(a, b, c, d, e, f) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            return Pa[a & 1](b | 0, c | 0, d | 0, e | 0, f | 0) | 0
        }

        function If(a, b, c, d, e, f, g, h) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            Qa[a & 7](b | 0, c | 0, d | 0, e | 0, f | 0, g | 0, h | 0)
        }

        function Jf(a, b, c) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            aa(0);
            return 0
        }

        function Kf(a, b, c, d, e, f, g, h, i, j, k) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            i = i | 0;
            j = j | 0;
            k = k | 0;
            aa(1)
        }

        function Lf(a, b, c, d, e, f, g, h, i, j) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            i = i | 0;
            j = j | 0;
            aa(2)
        }

        function Mf(a, b, c, d, e) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            aa(3)
        }

        function Nf(a) {
            a = a | 0;
            aa(4)
        }

        function Of(a, b) {
            a = a | 0;
            b = b | 0;
            aa(5)
        }

        function Pf(a, b, c, d, e, f) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            aa(6);
            return 0
        }

        function Qf(a, b, c, d, e, f, g, h, i) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            i = i | 0;
            aa(7)
        }

        function Rf(a, b, c, d, e, f, g, h, i, j, k, l) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            i = i | 0;
            j = j | 0;
            k = k | 0;
            l = l | 0;
            aa(8)
        }

        function Sf(a) {
            a = a | 0;
            aa(9);
            return 0
        }

        function Tf(a, b, c) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            aa(10)
        }

        function Uf(a, b, c, d, e, f, g, h) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            h = h | 0;
            aa(11)
        }

        function Vf(a, b, c, d) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            aa(12);
            return 0
        }

        function Wf(a, b, c, d, e, f) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            aa(13)
        }

        function Xf(a, b) {
            a = a | 0;
            b = b | 0;
            aa(14);
            return 0
        }

        function Yf(a, b, c, d, e) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            aa(15);
            return 0
        }

        function Zf(a, b, c, d, e, f, g) {
            a = a | 0;
            b = b | 0;
            c = c | 0;
            d = d | 0;
            e = e | 0;
            f = f | 0;
            g = g | 0;
            aa(16)
        }

        // EMSCRIPTEN_END_FUNCS
        var Aa = [Jf, Id];
        var Ba = [Kf, Yc, Zc, _c, $c, dd, ed, fd];
        var Ca = [Lf, ce];
        var Da = [Mf, ld, md, Mf];
        var Ea = [Nf, ac, Lc, Qc, Rc, Sc, Tc, Nf];
        var Fa = [Of, Jc, Mc, Nc, Oc, Pc, Bd, qe, Ae, Of, Of, Of, Of, Of, Of, Of];
        var Ga = [Pf, Gd];
        var Ha = [Qf, gd];
        var Ia = [Rf, hd, id, Rf];
        var Ja = [Sf, Zb, $b, se, re, Sf, Sf, Sf];
        var Ka = [Tf, Fc, Gc, Hc, Ic, Kc, Tf, Tf];
        var La = [Uf, Uc, Vc, Wc, Xc, ad, bd, cd];
        var Ma = [Vf, _b];
        var Na = [Wf, Ec, jd, kd];
        var Oa = [Xf, dc];
        var Pa = [Yf, Hd];
        var Qa = [Zf, Ye, Ze, _e, Xe, Zf, Zf, Zf];
        return {
            _i64Subtract: ff,
            _free: af,
            _bpg_decoder_decode: Pe,
            _bpg_decoder_start: Je,
            _realloc: bf,
            _i64Add: gf,
            _bpg_decoder_open: Oe,
            _bitshift64Ashr: ef,
            _strlen: hf,
            _bpg_decoder_get_info: Ie,
            _memset: jf,
            _malloc: $e,
            _memcpy: mf,
            _bpg_decoder_get_line: Le,
            _bpg_decoder_close: Re,
            _bpg_decoder_get_frame_duration: Ke,
            _llvm_bswap_i32: lf,
            _bitshift64Shl: kf,
            runPostSets: df,
            stackAlloc: Ra,
            stackSave: Sa,
            stackRestore: Ta,
            setThrew: Ua,
            setTempRet0: Xa,
            getTempRet0: Ya,
            dynCall_iiii: sf,
            dynCall_viiiiiiiiiii: tf,
            dynCall_viiiiiiiiii: uf,
            dynCall_viiiii: vf,
            dynCall_vi: wf,
            dynCall_vii: xf,
            dynCall_iiiiiii: yf,
            dynCall_viiiiiiiii: zf,
            dynCall_viiiiiiiiiiii: Af,
            dynCall_ii: Bf,
            dynCall_viii: Cf,
            dynCall_viiiiiiii: Df,
            dynCall_iiiii: Ef,
            dynCall_viiiiii: Ff,
            dynCall_iii: Gf,
            dynCall_iiiiii: Hf,
            dynCall_viiiiiii: If
        }
    })

    // EMSCRIPTEN_END_ASM
    (Module.asmGlobalArg, Module.asmLibraryArg, buffer);
    var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
    var _free = Module["_free"] = asm["_free"];
    var _bpg_decoder_decode = Module["_bpg_decoder_decode"] = asm["_bpg_decoder_decode"];
    var _bpg_decoder_start = Module["_bpg_decoder_start"] = asm["_bpg_decoder_start"];
    var _realloc = Module["_realloc"] = asm["_realloc"];
    var _i64Add = Module["_i64Add"] = asm["_i64Add"];
    var _bpg_decoder_open = Module["_bpg_decoder_open"] = asm["_bpg_decoder_open"];
    var _bitshift64Ashr = Module["_bitshift64Ashr"] = asm["_bitshift64Ashr"];
    var _strlen = Module["_strlen"] = asm["_strlen"];
    var _bpg_decoder_get_info = Module["_bpg_decoder_get_info"] = asm["_bpg_decoder_get_info"];
    var _memset = Module["_memset"] = asm["_memset"];
    var _malloc = Module["_malloc"] = asm["_malloc"];
    var _memcpy = Module["_memcpy"] = asm["_memcpy"];
    var _bpg_decoder_get_line = Module["_bpg_decoder_get_line"] = asm["_bpg_decoder_get_line"];
    var _bpg_decoder_close = Module["_bpg_decoder_close"] = asm["_bpg_decoder_close"];
    var _bpg_decoder_get_frame_duration = Module["_bpg_decoder_get_frame_duration"] = asm["_bpg_decoder_get_frame_duration"];
    var _llvm_bswap_i32 = Module["_llvm_bswap_i32"] = asm["_llvm_bswap_i32"];
    var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
    var runPostSets = Module["runPostSets"] = asm["runPostSets"];
    var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
    var dynCall_viiiiiiiiiii = Module["dynCall_viiiiiiiiiii"] = asm["dynCall_viiiiiiiiiii"];
    var dynCall_viiiiiiiiii = Module["dynCall_viiiiiiiiii"] = asm["dynCall_viiiiiiiiii"];
    var dynCall_viiiii = Module["dynCall_viiiii"] = asm["dynCall_viiiii"];
    var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
    var dynCall_vii = Module["dynCall_vii"] = asm["dynCall_vii"];
    var dynCall_iiiiiii = Module["dynCall_iiiiiii"] = asm["dynCall_iiiiiii"];
    var dynCall_viiiiiiiii = Module["dynCall_viiiiiiiii"] = asm["dynCall_viiiiiiiii"];
    var dynCall_viiiiiiiiiiii = Module["dynCall_viiiiiiiiiiii"] = asm["dynCall_viiiiiiiiiiii"];
    var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
    var dynCall_viii = Module["dynCall_viii"] = asm["dynCall_viii"];
    var dynCall_viiiiiiii = Module["dynCall_viiiiiiii"] = asm["dynCall_viiiiiiii"];
    var dynCall_iiiii = Module["dynCall_iiiii"] = asm["dynCall_iiiii"];
    var dynCall_viiiiii = Module["dynCall_viiiiii"] = asm["dynCall_viiiiii"];
    var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
    var dynCall_iiiiii = Module["dynCall_iiiiii"] = asm["dynCall_iiiiii"];
    var dynCall_viiiiiii = Module["dynCall_viiiiiii"] = asm["dynCall_viiiiiii"];
    Runtime.stackAlloc = asm["stackAlloc"];
    Runtime.stackSave = asm["stackSave"];
    Runtime.stackRestore = asm["stackRestore"];
    Runtime.setTempRet0 = asm["setTempRet0"];
    Runtime.getTempRet0 = asm["getTempRet0"];
    var i64Math = null;
    if (memoryInitializer) {
        if (typeof Module["locateFile"] === "function") {
            memoryInitializer = Module["locateFile"](memoryInitializer)
        } else if (Module["memoryInitializerPrefixURL"]) {
            memoryInitializer = Module["memoryInitializerPrefixURL"] + memoryInitializer
        }

        addRunDependency("memory initializer");
        Browser.asyncLoad(memoryInitializer, (function(data) {
            HEAPU8.set(data, STATIC_BASE);
            removeRunDependency("memory initializer")
        }), (function(data) {
            throw "could not load memory initializer " + memoryInitializer
        }))
    }

    function ExitStatus(status) {
        this.name = "ExitStatus";
        this.message = "Program terminated with exit(" + status + ")";
        this.status = status
    }
    ExitStatus.prototype = new Error;
    ExitStatus.prototype.constructor = ExitStatus;
    var initialStackTop;
    var preloadStartTime = null;
    var calledMain = false;
    dependenciesFulfilled = function runCaller() {
        if (!Module["calledRun"] && shouldRunNow) run();
        if (!Module["calledRun"]) dependenciesFulfilled = runCaller
    };

    function run(args) {
        args = args || Module["arguments"];
        if (preloadStartTime === null) preloadStartTime = Date.now();
        if (runDependencies > 0) {
            return
        }
        preRun();
        if (runDependencies > 0) return;
        if (Module["calledRun"]) return;

        function doRun() {
            if (Module["calledRun"]) return;
            Module["calledRun"] = true;
            if (ABORT) return;
            ensureInitRuntime();
            preMain();
            if (preloadStartTime !== null) {
                Module.printErr("pre-main prep time: " + (Date.now() - preloadStartTime) + " ms")
            }
            postRun()
        }
        if (Module["setStatus"]) {
            Module["setStatus"]("Running...");
            setTimeout((function() {
                setTimeout((function() {
                    Module["setStatus"]("")
                }), 1);
                doRun()
            }), 1)
        } else {
            doRun()
        }
    }
    Module["run"] = Module.run = run;

    function exit(status) {
        if (Module["noExitRuntime"]) {
            return
        }
        ABORT = true;
        EXITSTATUS = status;
        STACKTOP = initialStackTop;
        exitRuntime();

        throw new ExitStatus(status)
    }
    Module["exit"] = Module.exit = exit;

    function abort(text) {
        if (text) {
            Module.print(text);
            Module.printErr(text)
        }
        ABORT = true;
        EXITSTATUS = 1;
        var extra = "\nIf this abort() is unexpected, build with -s ASSERTIONS=1 which can give more information.";
        throw "abort() at " + stackTrace() + extra
    }
    Module["abort"] = Module.abort = abort;
    if (Module["preInit"]) {
        if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
        while (Module["preInit"].length > 0) {
            Module["preInit"].pop()()
        }
    }
    var shouldRunNow = true;
    if (Module["noInitialRun"]) {
        shouldRunNow = false
    }
    run();
    var BPGDecoder = (function(ctx) {
        this.ctx = ctx;
        this["imageData"] = null;
        this["onload"] = null;
        this["frames"] = null;
        this["loop_count"] = 0
    });
    BPGDecoder.prototype = {
        malloc: Module["cwrap"]("malloc", "number", ["number"]),
        free: Module["cwrap"]("free", "void", ["number"]),
        bpg_decoder_open: Module["cwrap"]("bpg_decoder_open", "number", []),
        bpg_decoder_decode: Module["cwrap"]("bpg_decoder_decode", "number", ["number", "array", "number"]),
        bpg_decoder_get_info: Module["cwrap"]("bpg_decoder_get_info", "number", ["number", "number"]),
        bpg_decoder_start: Module["cwrap"]("bpg_decoder_start", "number", ["number", "number"]),
        bpg_decoder_get_frame_duration: Module["cwrap"]("bpg_decoder_get_frame_duration", "void", ["number", "number", "number"]),
        bpg_decoder_get_line: Module["cwrap"]("bpg_decoder_get_line", "number", ["number", "number"]),
        bpg_decoder_close: Module["cwrap"]("bpg_decoder_close", "void", ["number"]),
        load: (function(url) {
            var request = new XMLHttpRequest;
            var this1 = this;
            request.open("get", url, true);
            request.responseType = "arraybuffer";
            request.onload = (function(event) {
                this1._onload(request, event)
            });
            request.send()
        }),
        _onload: (function(request, event) {
            var data = request.response;
            var array = new Uint8Array(data);
            var img, w, h, img_info_buf, cimg, p0, rgba_line, w4, frame_count;
            var heap8, heap16, heap32, dst, v, i, y, func, duration, frames, loop_count;
            img = this.bpg_decoder_open();
            if (this.bpg_decoder_decode(img, array, array.length) < 0) {
                console.log("could not decode image");
                return
            }
            img_info_buf = this.malloc(5 * 4);
            this.bpg_decoder_get_info(img, img_info_buf);
            heap8 = Module["HEAPU8"];
            heap16 = Module["HEAPU16"];
            heap32 = Module["HEAPU32"];
            w = heap32[img_info_buf >> 2];
            h = heap32[img_info_buf + 4 >> 2];
            loop_count = heap16[img_info_buf + 16 >> 1];
            w4 = w * 4;
            rgba_line = this.malloc(w4);
            frame_count = 0;
            frames = [];
            for (;;) {
                if (this.bpg_decoder_start(img, 1) < 0) break;
                this.bpg_decoder_get_frame_duration(img, img_info_buf, img_info_buf + 4);
                duration = heap32[img_info_buf >> 2] * 1e3 / heap32[img_info_buf + 4 >> 2];
                cimg = this.ctx.createImageData(w, h);
                dst = cimg.data;
                p0 = 0;
                for (y = 0; y < h; y++) {
                    this.bpg_decoder_get_line(img, rgba_line);
                    for (i = 0; i < w4; i = i + 1 | 0) {
                        dst[p0] = heap8[rgba_line + i | 0] | 0;
                        p0 = p0 + 1 | 0
                    }
                }
                frames[frame_count++] = {
                    "img": cimg,
                    "duration": duration
                }
            }
            this.free(rgba_line);
            this.free(img_info_buf);
            this.bpg_decoder_close(img);
            this["loop_count"] = loop_count;
            this["frames"] = frames;
            this["imageData"] = frames[0]["img"];
            if (this["onload"]) this["onload"]()
        })
    };
    return BPGDecoder
})()
