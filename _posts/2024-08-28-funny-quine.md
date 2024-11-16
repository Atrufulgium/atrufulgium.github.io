---
layout: post
title: A funny MATLAB quine
title-lower: a funny matlab quine
title-tiny: Funny quine
blurb: Code that spits out itself... Isn't recreational programming lovely?
usemathjax: true
tags: matlab recreational
---
{::nomarkdown}

[block]
At uni, we used Matlab to torture large matrices in various ways, begrudgingly making them tell us their properties, and all of that good stuff. As a side effect, I inadvertently learnt that Matlab, as a programming language, has some pretty weird quirks.

Let's talk quines.

In 2021, I bought this cool book "*The world of obfuscated, esoteric, artistic programming*".[^1] As it says on the tin, it's all about how to have *fun* with programming, instead of using programming as a means to an end. This book mostly discusses various forms of *quines*, programs that output their own source code. In other words, `quine`, and `eval(quine)` should be the same.

If you've never seen quines before, it's a neat little exercise to try and write one yourself! An extreme example is the (in)famous "[Quine Relay](https://github.com/mame/quine-relay)", a program that outputs its own code *after travelling through 127 other languages*. Of course, it's written by the same guy as that book.

A basic quine
=============

*Note: While I'll say "Matlab" throughout this post, I'll actually be using Octave instead. I like open source more than I like high license fees. There's also an [online interface](https://octave-online.net/). This means you can just copy-paste any code in this post and run it. (This* does *mean I might be using Octave-only quirks.)*

We'll start out with a pretty lousy quine. This is your last chance to write one yourself, without spoilers!

Did you do it? Great! I hope. I assume. I don't actually know whether you did it.

In any case, here is a basic quine:

```matlab
strrep(s = "strrep(s = #, char(35), [char(34), s, char(34)])", char(35), [char(34), s, char(34)])
```

Before I get to the explanation, if you want to actually use this code as a string, you'll have to escape the `"` apostrophes to `""` double apostrophes. This would give:
```matlab
>>> code = "strrep(s = ""strrep(s = #, char(35), [char(34), s, char(34)])"", char(35), [char(34), s, char(34)])"
>>> isequal(code, eval(code))

ans = 1
```

You can see that this renders all syntax highlighting void and creates pretty confusing nested strings, so I won't be doing that.

Now, let's discuss what's actually going on here. First, our main character, `strrep`. This is simply a function `strrep(text, search, replace) : string`. It looks for *all* instances of `search` in `text`, and replaces them with `replace`.

Now, what do we replace with what in our quine? Well, we search for `char(35)` (`#`). There is only one `#` in our string, and that is where the magic self-reference will happen. If you look at our quine, the `#` is placed inside the string where the string itself is in the outer code. In other words, inside the string, the text before the `#` is the same as the code before the string, and the text after the `#` is the same as the code after the string.

The idea then is that we will replace the `#` with the string itself, which will then give us our original code.

Now, the rest of the quine is scaffolding to make the dream work. For instance, I unsubtly emphasised that `strrep` replaces *all* occurrences of the search string. This means we can't simply put `'#'` as our replace string directly:
```matlab
>>> strrep(s = "strrep(s = #, '#', [char(34), s, char(34)])", '#', [char(34), s, char(34)])

ans = strrep(s = "strrep(s = #, '#', [char(34), s, char(34)])", '"strrep(s = #, '#', [char(34), s, char(34)])"', [char(34), s, char(34)])
```
This just creates a mess, as we also replace our search string; the syntax-highlighter can't even parse this result properly, it's *that* wrong!

For this reason, we write `char(35)` instead of `'#'` in the search string. The *values* are the same, but their *representation* isn't. Quines like to abuse things like this.

Now, we haven't yet discussed what we're replacing our string with, beyond saying "the string itself". Luckily, in Matlab, this is easy. First, assignments return their own value. This allows us to declare a variable inside a call:
```matlab
>>> disp(hi = "hello")

hello

>>> hi

hi = hello
```
And now, because Matlab's interpreted pretty straightforwardly, we can *immediately reuse* declared variables.
```matlab
>>> disp((number = 3) * number)

9
```
Back to our quine. We assign `s` to be our string, so that we can immediately reuse it in the `replace` argument of `strrep`. The syntax `[char(34), s, char(34)]` looks somewhat funky, but all it does is surround `s` with `char(34)` (`"`). This is what we wanted to replace `#` with, so we are done already!

Well, that was easy
===================
Finding quines is not *that* hard, really. It's possible to prove that for *any* program $f$ (we allow for I/O), there exists a program $p_f$ so that "$p_f$ with empty input" and "$f$ fed $p_f$ as input" have the same output behaviour.[^2] Then, if $f$ is a program that copies its input over to the output, $p_f$ is our quine: the output of "$p_f$" is the output of "$f$ fed $p_f$ as input" is $p_f$.

The proof is even constructive, so there's really no fun in keeping it like this. What's the point of recreational programming if some mathematician gave you the recipe in 19XX already?

There's only one thing we can do in this case. And that's adding an *absolutely dumb* additional restriction so that you truly have a problem no one has ever thought about before.

Let's expand on this `[char(34), s, char(34)]` thing we saw earlier. In Matlab, vectors and matrices are first-class citizens, with the programming language literally being called "Matrix Laboratory" and all. It has a ton of syntactic sugar when it comes to linear algebra.

One such example is embedding vectors within vectors. You can write `[numberA, vectorB, numberC]`, and everything gets concatenated into a single vector:
```matlab
>>> a = [1, 2, 3];
>>> [0, a, 4]

ans =

   0   1   2   3   4
```
Now, `char`s are just numbers. And well, if you have a sequence of numbers, calling them a `vector` or a `string`, it's just a matter of interpretation really.
```matlab
>>> [72, "ell", char(111)]

ans = Hello
```
As part of the linear algebraic syntactic sugar, Matlab also allows accessing multiple entries at once. (Note that Matlab is 1-indexed.)
```matlab
>>> a = ["a", "b", "c"];
>>> a([3,2,1])

ans = cba
```
But if both your vectors and your indexers can be multiple numbers i.e. strings, what stops you from doing weirder stuff?

```matlab
>>> s = "012345678901234567890123456789012345678901234567890123456789";
>>> s(s)

ans = 789012345678901234567890123456789012345678901234567890123456
```
Now we're doing *fun* stuff. Converting our characters to ascii, we made a vector `[48, 49, .., 56, 57]`. We then indexed this vector by `[48, 49, .., 56, 57]` again, which indeed gives that string.

Can you see what dumb challenge I'm about to pose myself?

Hard mode
=========
We have found a new goal. Find a string `code`, such that[^3]:
```matlab
>>> isequal(code, eval(code))

ans = 1

>>> isequal(code, code(code))

ans = 1
```
If you want to try for yourself, I'll spoil one thing: *it's possible*. I don't know if I've emphasised it enough, but it's also *dumb as heck*. If you *legitimately* want to try, **stop scrolling**, as the next code block will contain my solution.  
(Not that a passing glance will help you in any way, shape, or form, but still.)

Let's first reflect a little. Basically every language has a quine[^2]. But when you add extra requirements, you don't have the guarantee that a solution exists any longer. It's just a matter of bashing your head against the wall because it *looks* possible.

And then, half the time, you're a character short from it actually being possible. Or so you think. You're not going to get any confirmation however, because you're not going to spend your time putting your additional dumb restrictions into mathematical proof.

Could you imagine? In this case, in your proof you would have to account for all of ascii, and all of Matlab's little quirks. That seems painful.

My head was sufficiently bashed when I finally found a solution to this dumb problem, so I'm going to guide you through all the little things needed to make it work.

I think I've rambled enough, and it's safe to put my solution in a code block so that those zero people don't get spoiled.

<!-- I had some tabs/spaces issues while writing this, by god I hope nothing's fucked up. -->
```matlab
[  ''()*1,-''*123,strrep(s=      "[  ''()*1,-''*123,strrep(s=      D,char(31*3-22-3),[    [,],' a c e  h       p rst'(2)-31-32,s,12*3-2])]",char(31*3-22-3),[    [,],' a c e  h       p rst'(2)-31-32,s,12*3-2])]
```

yeahhh...

This is *more like* what the result of recreational programming tends to look like. Weird whitespace, character sequences that shouldn't be valid in any sane language, magic numbers all over, it's quite lovely, really.

However, copy it over, and it works!

```matlab
>>> code = "[  ''()*1,-''*123,strrep(s=      ""[  ''()*1,-''*123,strrep(s=      D,char(31*3-22-3),[    [,],' a c e  h       p rst'(2)-31-32,s,12*3-2])]"",char(31*3-22-3),[    [,],' a c e  h       p rst'(2)-31-32,s,12*3-2])]";
>>> isequal(code, eval(code))

warning: implicit conversion from numeric to char
warning: implicit conversion from numeric to char
ans = 1

>>> isequal(code, code(code))

ans = 1
```

Fundamentally, it's actually not too different from the basic quine we discussed earlier. The `#` in the basic quine has become a `D` in this quine, so you can actually see the exact same structure if you try pretty hard. Everything before the `D` is everything before the big string, everything after `D` is everything after the big string.

Things only got whacky because of the `code == code(code)` requirement. This requirement enforces the following rule: for every distinct character `c` in our `code`, the `c`th character of `code` must be `c`.

If we put ascii below our quine, we can see this property holds.
[nowrap]
```matlab
 [  ''()*1,-''*123,strrep(s=      "[  ''()*1,-''*123,strrep(s=      D,char(31*3-22-3),[    [,],' a c e  h       p rst'(2)-31-32,s,12*3-2])]",char(..
%[Weird/unprintable ascii chars] !"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}~
% Matches:                      ^ ^    ^^^^ ^^   ^^^         ^      ^                      ^ ^   ^ ^ ^  ^       ^ ^^^
```
[/nowrap]
Every character `c` that appears in our quine, appears in particular as the `c`th character. These positions are highlighted as `^` in the `% Matches` line.

Now, time to build this thing.

Step by step
============
Let's take a look at our basic quine again.
```matlab
strrep(s = "strrep(s = #, char(35), [char(34), s, char(34)])", char(35), [char(34), s, char(34)])
```
In this quine, we used the following ascii characters: `"#(),345=[]acehprst `. This is a fairly small set. However, when trying to have each character at its proper position, we run into problems.

-   If we want to use both `"` and `#` we're in trouble, as in ascii, they're right next to each other. This would force us to start our Matlab code with `#`, which is... kinda not possible.

    Luckily, the `#` character is the most easily replaced character. We only use it once; the other instance refers to it by a number instead.
-   The neighbourhood of `=` in ascii is very awkward: `..789:;<=>?@ABC..`. With the `strrep(s=`-approach, we lose quite some digits: `4` through `9` are guaranteed to be unavailable. If we still want to use numbers, we'll have to get some arithmetic from somewhere. This will impose additional restrictions.
-   We have a choice with the string delimiter, either `"` or `'`. Taking into account both the outer code and inner string and how they align with ascii, this enforces quite some restrictions.

    With `"`, we must start with `×××××()××,××××××345×××××××=××× ××"`, where `×` represents free space we can fill in however we want.

    With `'`, we must start with `()××,××××××345×××××××✖××××××'`. Because of poor overlap, the big ✖ needs to be both an `=`-sign, and a space. This is impossible, so the choice is made for us.

So now we pretty much know that our code should start with `×××××()××,××××××3×strrep(s=××× ××"`, and that we need to take enable arithmetic somehow, because our original character set is not going to cut it. In particular, we *will* need the numeric value `34` to create `"`, but we don't have access to `4`.

Let's take a look at where we need to put arithmetic characters to unlock them: `×××××()*+,-×/×××3×strrep(s=××× ××"`. Well then... They're all piled up in one spot in ascii. This means that we clearly cannot unlock all of them.

First, we need to give up on `+`. There is no context in which `+,` is valid in Matlab, except inside strings. Unfortunately, non-empty strings are a bit awkward in the very limited space before the `strrep`.

However, we *can* unlock both `*` and `-` with some beautiful vector abuse. You see, `''` is the empty vector. But you can still access it -- `()` gives you the entire vector. You can also still do arithmetic with the empty vector.
```matlab
>>> ''()*1

ans = []

>>> -''*123

ans = []
```
Concatenating the empty vector before a string does not change anything. This means that we can freely start our quine with `[  ''()*1,-''*123` and have access to `()`, `*`, `-`, and `123`. As a bonus, we even get `'` for free, which will save us from some string-related headaches later down the line.

This way, we also have enough space to put the `strrep(s=` after unlocking our arithmetic. This fixes the first half of our quine already.
```matlab
 [  ''()*1,-''*123,strrep(s=      "[  ''()*1,-''*123,strrep(s=      ..
%[Weird/unprintable ascii chars] !"#$%&'()*+,-./0123456789:;<=>?@ABC..
% Matches:                      ^ ^    ^^^^ ^^   ^^^         ^      ..
```
Next up is our replacement character, which must be unique in the string. Well, what better choice than the ascii character that appears at that position? That would be `D`.

```matlab
 [  ''()*1,-''*123,strrep(s=      "[  ''()*1,-''*123,strrep(s=      D..
%[Weird/unprintable ascii chars] !"#$%&'()*+,-./0123456789:;<=>?@ABCD..
% Matches:                      ^ ^    ^^^^ ^^   ^^^         ^      ^..
```

Now we're *almost* home-free. There's only the `search` and `replace` strings left to do. Compared to the basic quine, we need to take two more things into account:
- We still need to put `[]` and all the letters in their correct spots.
- We need to express our `char(×)`s with just `123*-`.
 
The ascii from `D` onwards is ``DEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abc..``. This is quite some space for us to work with before we have to think about the `[]`s. In fact, this is enough space to specify `D` as `char(68)` with the characters at our disposal, with a ton of room left, even:
```matlab
 ..D,char(31*3-22-3),..
%..DEFGHIJKLMNOPQRSTU..
```

Now for our replacement string, we'll write it in vector notation `[ .. ]`, just like the basic quine. However, we'll have to do some tricky tricks.

First, we need to match the `[]` in the ascii `..Z[\]^..`. Fortunately, Matlab is nice, and allows trailing commas in vectors. This includes the empty vector; `[,]` is completely valid, and does not contribute anything to our string.

Finally, we need to include some letters. There's no neat way to go about this, so just dump them into a string:

```matlab
 ..[    [,],' a c e  h       p rst'..
%..VWXYZ[\]^_`abcdefghijklmnopqrstu..
```
It really helps that we could get `'` for free. Remember: the code that we are writing appears both outside and inside a `"`-delimited string, so if we couldn't have used `'`, our life would have become a little worse.

After this string, we're free to format our code however we like; there are no more ascii-restrictions.

However, we don't actually want to concatenate this letters string into the result like this. The solution to this is simple: just grab a random character from this string to build `34`, representing `"`.
```matlab
 ..[    [,],' a c e  h       p rst'(2)-31-32,..
%..VWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}~
```
Because `a - 31 - 32` and `"` are the same thing. Obviously.

Now follow this up with `s` and another expression that evaluates to `34`, and we are done. This gives us our entire quine:

```matlab
[  ''()*1,-''*123,strrep(s=      "[  ''()*1,-''*123,strrep(s=      D,char(31*3-22-3),[    [,],' a c e  h       p rst'(2)-31-32,s,12*3-2])]",char(31*3-22-3),[    [,],' a c e  h       p rst'(2)-31-32,s,12*3-2])]
```

This is the single most useless and unreadable piece of code I've written in my life, but I thoroughly enjoyed this puzzle. And compared to what some people manage to create in the name of recreation, this isn't *that* unreadable.

Conclusion
==========
Quines are quite fun.

Oh, I should write some more words in this part? Huh...

...

Nah, screw it. What more than "quines are fun" do you really need for a post like this? You there. Reader.

[sketch]
[![Go do a quine.](/resources/images/quine/go-do-a-quine.png)][hover-go-do-a-quine]

[hover-go-do-a-quine]: ## "Now, it would be really awkward if you weren't familiar with this meme format."

[/sketch]

[/block]

[^1]:
    Better known by its Japanese title "あなたの知らない超絶技巧プログラミングの世界", by Yusuke Endoh. It seems like there's still not an English version out there, unfortunately.
    
    I've heard Google Lens's gotten pretty good at translating lately, why don't you try that?

[^2]:
    For those weirdos that studied and even *liked* math, I'll shamelessly yoink the sketch proof from the book and sketchify it even further.
    
    For two programs $p_1$ and $p_2$, we write $p_1 \sim p_2$ when the two programs behave the same for all inputs: either the two output strings are the same, or both programs don't halt.

    Next, let $E$ be a program where $E(p,s)$ is the output (if it halts) of running program $p$ with input string $s$. (Note that $E$ can be implemented in any Turing-complete language, as it's basically the compiler/interpreter.)

    Next, define a few programs such that for all inputs $x$, $y$:
    - Let $h_x$ be such that $E(h_x, y) \sim E(E(x,x),y)$.
    - Let $h$ be such that $E(h,x) = h_x$.
    - Let $e$ be such that $E(e,x) \sim E(f, E(h,x))$.
    - Now, define $p_f = h_e$.

    We're skipping over a bunch of details here, but eh, who cares.
    
    With these definitions, you can show that for any input string $x$, $E(p_f,x) = E(E(f,p_f), x)$ so that $p_f \sim E(f,p_f)$. This matches the claim that "$p_f$ with empty input" and "$f$ fed $p_f$ as input" have the same output behaviour.

[^3]: It should also be a one-liner. Otherwise, you'd easily stumble upon the trivial solution "put the hard part in a comment, and the quine on the line after", and that's no fun.
{:/nomarkdown}