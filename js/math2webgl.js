// Could this be done with just regex?
// _Probably_. Apart from the order of operations.
// Is this more fun?
// _Yes_!

function math2webgl(script) {
    var AST = new Parser(new Lexer(script).tokenize()).parse();
    //console.log("ASTpre:", AST);
    AST.fixType();
    //console.log("ASTpost:", AST);
    return AST.getScript();
}

// Assuming 0-indexed in code.
function throwError(col, error) {
    throw `[Parsing] ${error} (char ~${col+1})`;
}

// Adds "." to a numeric string if it doesn't
// have any . because gl plss
function fixNumber(val) {
    return val.indexOf(".") >= 0 ? val : `${val}.`;
}

class MathFunction {
    constructor(id, args, output, webGLReal, webGLComplex, precedence) {
        this.id = id;
        this.args = args; // R: always R. C: R or C.
        this.output = output; // R: real; C: complex; S: R unless any C in input (check compile-time)
        this.webGLReal = webGLReal;
        this.webGLComplex = webGLComplex;
        if (precedence)
            this.precedence = precedence;
        else
            this.precedence = 0;
    }
}

// ops (operator is in the middle)
var ops = {
    "+":        new MathFunction("+", "CC", "S", "#+#", "#+#", 20),
    "-":        new MathFunction("-", "CC", "S", "#-#", "#-#", 20),
    "*":        new MathFunction("*", "CC", "S", "#*#", "cMul(#,#)", 30),
    "/":        new MathFunction("/", "CC", "S", "#/#", "cDiv(#,#)", 30),
    "%":        new MathFunction("%", "RR", "S", "#%#", null, 30),
    "^":        new MathFunction("^", "CC", "C", "pow(#,#)", "cPow(#,#)", 40),
}

// other (operator on the left)
var functions = {
    "re":       new MathFunction("re", "C", "R", "#", "vec2((#).x,0.)"),
    "im":       new MathFunction("im", "C", "R", "0", "vec2((#).y,0.)"),
    "abs":      new MathFunction("abs", "C", "R", "vec2(abs((#).x),0.)", "vec2(length(#),0.)"),
    "sgn":      new MathFunction("sgn", "R", "S", "vec2(sign((#).x),0.)", null),
    "normalize":new MathFunction("normalize", "C", "R", "vec2(sign((#).x),0.)", "normalize(#)"),
    "ceil":     new MathFunction("ceil", "R", "S", "vec2(ceil((#).x),0.)", null),
    "floor":    new MathFunction("floor", "R", "S", "vec2(floor((#).x),0.)", null),
    "round":    new MathFunction("round", "R", "S", "round(#)", null),
    "fract":    new MathFunction("fract", "R", "S", "fract(#)", null),
    "clamp":    new MathFunction("clamp", "RRR", "S", "vec2(clamp((#).x,(#).x,(#).x),0.)", null),
    "max":      new MathFunction("max", "RR", "S", "vec2(max((#).x,(#).x),0.)", null),
    "min":      new MathFunction("min", "RR", "S", "vec2(min((#).x,(#).x),0.)", null),
    "avg":      new MathFunction("avg", "CC", "S", "((#+#)/2)", "((#+#)/2)"),
    "exp":      new MathFunction("exp", "C", "S", "exp(#)", "cExp(#)"),
    "ln":       new MathFunction("ln", "C", "C", "vec2(log((#).x),0.)", "cLog(#)"),
    "sqrt":     new MathFunction("sqrt", "C", "C", "sqrt(#)", "cSqrt(#)"),
    "cos":      new MathFunction("cos", "C", "S", "vec2(cos((#).x),0.)", "cCos(#)"),
    "sin":      new MathFunction("sin", "C", "S", "vec2(sin((#).x),0.)", "cSin(#)"),
    "tan":      new MathFunction("tan", "C", "S", "vec2(tan((#).x),0.)", "cTan(#)"),
    "cosh":     new MathFunction("cosh", "C", "S", "vec2(cosh((#).x),0.)", "cCosh(#)"),
    "sinh":     new MathFunction("sinh", "C", "S", "vec2(sinh((#).x),0.)", "cSinh(#)"),
    "tanh":     new MathFunction("tanh", "C", "S", "vec2(tanh((#).x),0.)", "cTanh(#)"),
    "acos":     new MathFunction("acos", "C", "S", "vec2(acos((#).x),0.)", "cAcos(#)"),
    "asin":     new MathFunction("asin", "C", "S", "vec2(asin((#).x),0.)", "cAsin(#)"),
    "atan":     new MathFunction("atan", "C", "S", "vec2(atan((#).x),0.)", "cAtan(#)"),
    "acosh":    new MathFunction("acosh", "C", "S", "vec2(acosh((#).x),0.)", "cAcosh(#)"),
    "asinh":    new MathFunction("asinh", "C", "S", "vec2(asinh((#).x),0.)", "cAsinh(#)"),
    "atanh":    new MathFunction("atanh", "C", "S", "vec2(atanh((#).x),0.)", "cAtanh(#)")
}

class Lexer {
    constructor(script) {
        // cleanup first
        script = script.toLowerCase();
        script = script.replace(/log/g, "ln");
        script = script.replace(/\*\*/g, "^");
        script = script.replace(/\|([^\|]+)?\|/g,"abs($1)");
        script = script.replace(/pi|π/gi, "3.1415926535897932");
        this.script = script;
        // can't do anything if it's empty
        if (script.trim().length == 0)
            throwError(-1, "Cannot have an empty formula.");

        this.scriptLength = script.length;
        this.currentCol = 0;
    }

    tokenize() {
        // now start
        var tokens = [];
        this.currentCol = -1; //oops
        while (this.currentCol < this.scriptLength - 1) {
            this.currentCol++;
            while (this.getChar() == " ")
                this.currentCol++;

            // If it's an op, it's a fairly unique char. So those first.
            // Handles ** correctly as ** => ^ earlier.
            var c = this.getChar();
            if (!!ops[c]) {
                tokens.push(new Token(this.currentCol, TOKENTYPE.Op, c));
                continue;
            }
            // Non-op single-char things
            switch(c) {
                case ",": tokens.push(new Token(this.currentCol, TOKENTYPE.Comma)); continue;
                case "(": tokens.push(new Token(this.currentCol, TOKENTYPE.ParenOpen)); continue;
                case ")": 
                    tokens.push(new Token(this.currentCol, TOKENTYPE.ParenClose));
                    // ..)z => ..)*z, ..)re(z) => .)*re(z), ..)(.. => ..)*(.. etc
                    if (this.nextChar() && this.nextChar().match(/[a-z]|\(/g))
                        tokens.push(new Token(this.currentCol, TOKENTYPE.Op, "*"));
                    continue;
            }

            // Now we just have words, numbers, and ""'s left. First do the ""'s.
            if (c == '"') {
                var code = "";
                var beginCol = this.currentCol;
                this.currentCol++;
                while (this.getChar() != '"') {
                    if (this.currentCol >= this.scriptLength)
                        throwError(beginCol, "Unclosed quotation marks while scanning");
                    code += this.getChar();
                    this.currentCol++;
                }
                tokens.push(new Token(this.currentCol, TOKENTYPE.WebGL, code));
                continue;
            }

            // Words and numbers. Numbers first.
            if (this.isNumber(this.getChar())) {
                var num = this.getChar();
                while (this.isNumber(this.nextChar())) {
                    this.currentCol++;
                    num += this.getChar();
                }
                if (num === ".")
                    throwError(this.currentCol, ". is not a number.");
                tokens.push(new Token(this.currentCol, TOKENTYPE.Number, num));
                // 2z => 2*z, 2re(z) => 2*re(z), 2(.. => 2*(.. etc
                if (this.nextChar() && this.nextChar().match(/[a-z]|\(/g))
                    tokens.push(new Token(this.currentCol, TOKENTYPE.Op, "*"));
                continue;
            }

            // Word or "i" or "z"
            if (this.isLetter(this.getChar())) {
                var word = this.getChar();
                var beginCol = this.currentCol;
                while (this.isLetter(this.nextChar())) {
                    this.currentCol++;
                    word += this.getChar();
                }

                if (this.isEntirelyIZ(word)) {
                    // Change an iz-sequence to a multiplication of them
                    for (var i = 0; i < word.length; i++) {
                        if (i > 0)
                            tokens.push(new Token(beginCol+i, TOKENTYPE.Op, "*"));
                        if (word[i] == "i")
                            tokens.push(new Token(beginCol+i, TOKENTYPE.i));
                        else
                            tokens.push(new Token(beginCol+i, TOKENTYPE.z));
                    }
                    continue;
                }

                // This word better be a function.
                if (!!functions[word]) {
                    tokens.push(new Token(beginCol, TOKENTYPE.Function, word));
                    continue;
                }
                throwError(this.currentCol, `Unknown function '${word}'`);
            }
            // Other -- aka unknown
            throwError(this.currentCol, `Unexpected character '${this.getChar()}'`);
        }
        return tokens;
    }

    getChar() {
        return this.script[this.currentCol];
    }

    nextChar() {
        if (this.currentCol == this.scriptLength)
            return 0;
        return this.script[this.currentCol+1];
    }

    isLetter(c) {
        // Everything's lowercase anyway
        return c >= 'a' && c <= 'z';
    }

    isNumber(c) {
        return (c >= '0' && c <= '9') || c == ".";
    }

    // Yes I know lexers aren't supposed to do the parser's job
    // but putting it here makes my life a lot easier.
    isEntirelyIZ(word) {
        for(var i = 0; i < word.length; i++) {
            if (word[i] != "i" && word[i] != "z")
                return false;
        }
        return true;
    }
}

var TOKENTYPE = {
    "z": "z",
    "i": "i",
    // MathFunction of the form `# op #`
    "Op": "Op", // value: "+" or "-" or etc
    // MathFunction of the form `func(#)`
    "Function": "Function", // value: the function id
    "Number": "Number", // value: the number
    "Comma": "Comma",
    "ParenOpen": "ParenOpen",
    "ParenClose": "ParenClose",
    "WebGL": "WebGL" // value: the code
}

class Token {
    constructor(col, type, value) {
        if (!col && col != 0)
            throw "The column of the current token is a required argument"
        this.col = col;
        if (!type)
            throw "The tokentype is a required argument"
        this.type = type;
        if (value)
            this.value = value;
    }
}

class Parser {
    constructor(tokens) {
        var lastCorrectCol = 0;
        // Check if tokens
        for (var i = 0; i < tokens.length; i++) {
            if (tokens[i] instanceof Token) {
                lastCorrectCol = tokens[i].col;
            } else {
                throwError(lastCorrectCol, "Encountered a not-a-token after");
            }
        }
        this.tokens = tokens;
        this.currentTokenIndex = 0;
        this.currentCol = 0;
        this.tokenCount = tokens.length;
    }

    parse() {
        this.currentTokenIndex = -1; // zelfde oops als bij de lexer
        this.popToken();
        // What we're parsing is actually part of an expression
        //  `z = #`
        // so we just need to act the same as if this were any
        // ordinary expression.
        return this.parseExpression();
    }

    // All functions assume pop has been called before them.
    // i.e. currentToken is the first relevant token for any call.
    parseExpression() {
        var lhs = this.parsePrimary();
        return this.parseBinopRHS(1, lhs);
    }

    parsePrimary() {
        // Not in the list:
        // Comma, ParenClose, WebGL
        this.checkExpected([TOKENTYPE.z, TOKENTYPE.i, TOKENTYPE.Op /* unary */,
            TOKENTYPE.Function, TOKENTYPE.Number, TOKENTYPE.ParenOpen]);
        
        var col = this.currentCol;

        if (this.currentToken.type === TOKENTYPE.ParenOpen) {
            this.popToken(); // For the ParenOpen
            var returnnode = this.parseExpression();
            this.checkExpected(TOKENTYPE.ParenClose);
            this.popToken(); // For the ParenClose
            return returnnode;
        } else if (this.currentToken.type === TOKENTYPE.Op) {
            return this.parseUnary();
        } else if (this.currentToken.type === TOKENTYPE.Function) {
            return this.parseFunction();
        } else if (this.currentToken.type === TOKENTYPE.z) {
            this.popToken(); // For this z
            return new ASTz(col);
        } else if (this.currentToken.type === TOKENTYPE.i) {
            // (i is a shortcut for 1i)
            this.popToken(); // For this i
            return new ASTImaginary(col, "1");
        } else {
            return this.parseLiteral();
        }
    }

    parseUnary() {
        // Guaranteed the current token is TOKENTYPE.Op
        if (this.currentToken.value === "+") {
            this.popToken(); // The +
            return this.parsePrimary(); // Does nothing, why bother
        } else if (this.currentToken.value === "-") {
            // Hack it together as if there was written 0 - ....
            var lhs = new ASTReal(this.currentCol, "0");
            // No popping the token as conveniently enough
            // this next step assumes we're on an op.
            return this.parseBinopRHS(1, lhs);
        }
        throwError(this.currentCol, `Expected unary operation, got ${this.currentToken.value}`);
    }

    parseBinopRHS(prevprec, lhs) {
        // When calling, make sure prevprec >= 1 because nonops have 0.
        while (true) {
            // Null check because my reading of tokens is a mess
            if (!this.currentToken)
                return lhs;
            
            // The only things allowed after z+w are other operators, function
            // arguments, or function endings. This is a hacky place to put this
            // but eh. What about this code isn't hacky.
            this.checkExpected([TOKENTYPE.Op, TOKENTYPE.Comma, TOKENTYPE.ParenClose]);
            
            var op = this.currentToken.value;
            var prec = 0;
            if (op && ops[op])
                prec = ops[op].precedence;
            var col = this.currentCol;
            // We could be at the end of an .. + .. + .. ...
            // in which case we would look at the final "..."
            // This is not an op, and has automatic precedence
            // lowest. Also return if the precedence is lower and
            // should be handled by a different call.
            if (prec < prevprec)
                return lhs;
            // Now it *should* be guaranteed an op.
            this.checkExpected(TOKENTYPE.Op);
            this.popToken() // The op
            var rhs = this.parsePrimary();
            // Same situation as before, but now for after the rhs.
            // Do need to check if further tokens exist though.
            if (!!this.currentToken) {
                var op2 = this.currentToken.value;
                var nextprec = 0;
                if (op2 && ops[op2])
                    nextprec = ops[op2].precedence;
                if (prec < nextprec) {
                    this.checkExpected(TOKENTYPE.Op);
                    // If the next precedence is higher, parse that first
                    rhs = this.parseBinopRHS(prec + 1, rhs);
                }
            }
            lhs = new ASTOp(col, lhs, rhs, op);
        }
    }

    parseFunction() {
        // Guaranteed a function identifier
        var name = this.currentToken.value;
        var shape = functions[name].args;
        var col = this.currentCol;
        this.popToken(); // The function name
        this.checkExpected(TOKENTYPE.ParenOpen);
        this.popToken(); // The (
        var args = [];
        for (var i = 0; i < shape.length; i++) {
            args.push(this.parseExpression());
            if (i < shape.length - 1) {
                this.checkExpected(TOKENTYPE.Comma);
                this.popToken(); // The comma
            }
        }
        this.checkExpected(TOKENTYPE.ParenClose);
        this.popToken(); // The )
        return new ASTFunction(col, name, args);
    }

    parseLiteral() {
        // Guaranteed a number
        var value = this.currentToken.value;
        var peektype = this.peekToken() ? this.peekToken().type : undefined;
        var col = this.currentCol;
        this.popToken(); // The number
        if (peektype === TOKENTYPE.i) {
            this.popToken(); // The i
            return new ASTComplex(col, "0", value);
        } else if (peektype === TOKENTYPE.z) {
            this.popToken(); // The z
            // See `#z` as `#*z`.
            return new ASTOp(col, new ASTReal(col, value), new ASTz(col), "*");
        }
        return new ASTReal(col, value);
    }

    popToken() {
        this.currentTokenIndex++;
        this.currentToken = this.tokens[this.currentTokenIndex];
        if (this.currentToken !== undefined) {
            this.currentCol = this.currentToken.col;
        } else
            this.currentCol = undefined;
        return this.currentToken;
    }

    peekToken() {
        return this.tokens[this.currentTokenIndex + 1]
    }

    checkExpected(tokentypes) {
        let token = this.currentToken;
        let actualtype = token ? token.type : "Nothing";
        if (!token || !(actualtype === tokentypes || tokentypes.indexOf(actualtype) >= 0))
            throwError(this.currentCol, `Unexpected token ${actualtype}, expected ${tokentypes}`);
    }
}

var TYPE = {
    "undetermined": "undetermined",
    "unknowable": "unknownable",
    "real": "R",
    "complex": "C"
}

class ASTNode {
    constructor(col) {
        if (!col && col != 0)
            throw "The column of the current token is a required argument"
        this.col = col;
        this.type = TYPE.undetermined;
    }

    fixType() {}
    getScript() {}
}

// ========================================== //
//                 LITERALS
// ========================================== //

class ASTLiteral extends ASTNode {
    constructor(col) {
        super(col);
    }

    fixType() {}
    getScript() {}
}

class ASTReal extends ASTLiteral {
    constructor(col, val) {
        super(col);
        this.value = fixNumber(val);
        this.type = TYPE.real;
    }

    fixType() {}
    getScript() {
        return `vec2(${this.value},0.)`;
    }
}

class ASTImaginary extends ASTLiteral {
    constructor(col, val) {
        super(col);
        this.value = fixNumber(val);
        this.type = TYPE.complex;
    }

    fixType() {}
    getScript() {
        return `vec2(0.,${this.value})`;
    }
}

class ASTComplex extends ASTLiteral {
    constructor(col, real, complex) {
        super(col);
        this.real = fixNumber(real);
        this.complex = fixNumber(complex);
    }

    fixType() {
        this.type = +this.real === 0 ? TYPE.real : TYPE.complex;
    }
    getScript() {
        return `vec2(${this.real},${this.complex})`;
    }
}

class ASTz extends ASTLiteral {
    constructor(col) {
        super(col);
        this.type = TYPE.complex;
    }

    fixType() {}
    getScript() {
        return "z";
    }
}

class ASTWebGL extends ASTLiteral {
    constructor(col, code) {
        super(col);
        this.value = code;
        this.type = TYPE.unknowable;
    }

    fixType() {}
    getScript() {
        return code;
    }
}

// ========================================== //
//             OPS AND FUNCTIONS
// ========================================== //

class ASTOp extends ASTNode {
    constructor(col, lhs, rhs, op) {
        super(col);
        if (!(lhs instanceof ASTNode))
            throw "The LHS isn't an AST node";
        if (!(rhs instanceof ASTNode))
            throw "The RHS isn't an AST node";
        this.lhs = lhs;
        this.rhs = rhs;
        this.op = op;
    }

    fixType() {
        var lhs = this.lhs;
        var rhs = this.rhs;
        lhs.fixType();
        rhs.fixType();
        if (lhs.type === TYPE.undetermined || rhs.type === TYPE.undetermined)
            throwError(this.col, "Determining types failed.");

        var inp = ops[this.op].args;
        // Check if signature matches
        if (lhs.type === "C" && inp[0] === "R")
            throwError(lhs.col, "LHS of arithmetic can be complex, expected real.");
        if (rhs.type === "C" && inp[1] === "R")
            throwError(rhs.col, "RHS of arithmetic can be complex, expected real.");

        var out = ops[this.op].output;
        this.type = TYPE.real;
        if (out === "R")
            this.type = TYPE.real;
        else if (out === "C")
            this.type = TYPE.complex;
        else { // "S"
            if (lhs.type === "C" || rhs.type === "C")
                this.type = TYPE.complex;
            else
                this.type = TYPE.real;
        }
    }
    getScript() {
        var blueprint = this.type === "R" ? ops[this.op].webGLReal : ops[this.op].webGLComplex;
        blueprint = blueprint.replace("#", this.lhs.getScript());
        blueprint = blueprint.replace("#", this.rhs.getScript());
        return blueprint;
    }
}

class ASTFunction extends ASTNode {
    constructor(col, func, args) {
        super(col);
        this.func = func;
        this.args = args;
        this.complexInput = false;
    }

    fixType() {
        var inp = functions[this.func].args;
        var out = functions[this.func].output;

        for (var i = 0; i < this.args.length; i++) {
            var node = this.args[i];
            node.fixType();
            if (node.type === "C" && inp[i] === "R")
                throwError(node.col, `Arg #${i+1} of "${this.func}"-call can be complex, expected real.`);
            if (node.type === TYPE.undetermined)
                throwError(node.col, "Determining types failed.");

            this.complexInput |= node.type === "C";
        }
        if (out === "R")
            this.type = TYPE.real;
        else if (out === "C" || this.complexInput /* && out === "S" */)
            this.type = TYPE.complex;
        else
            this.type = TYPE.real;
    }
    getScript() {
        var blueprint = this.complexInput ? functions[this.func].webGLComplex : functions[this.func].webGLReal;
        for (var i = 0; i < this.args.length; i++)
            blueprint = blueprint.replace("#", this.args[i].getScript());
        return blueprint;
    }
}