---
layout: post
title: A funny MATLAB quine
title-lower: a funny matlab quine
title-tiny: Funny quine
blurb: Code that spits out itself... The epitome of recreational programming.
usemathjax: true
---
{::nomarkdown}

[block]
Time for a shorter post!

At uni, we used Matlab to torture large matrices in various ways, begrudgingly making them tell us their properties, and all of that good stuff. As a side effect, I inadvertently learnt that Matlab, as a programming language, has some pretty weird quirks.

Let's talk quines.

In 2021, I bought this cool book "*The world of obfuscated, esoteric, artistic programming*".[^1] As it says on the tin, it's all about how to have *fun* with programming, instead of using it as a means to an end. This book mostly discusses various forms of *quines*, programs that output their own source code. In other words, `quine`, and `eval(quine)` are the same.

If you've never seen quines before, it's a neat little exercise to try and write one yourself! An extreme example is the (in)famous "[Quine Relay](https://github.com/mame/quine-relay)", a program that outputs its own code *after travelling through 127 other languages*. Of course, it's written by the same guy as the book.

A basic quine
=============

*Note: While I'll say "Matlab" throughout this post, I'm actually using GNU Octave instead. I like open source more than I like high license fees. There's also an [online interface](https://octave-online.net/). This means you can just copy-paste any code in this post and run it. (This* does *mean I might be using Octave-only quirks, without knowing.)*

We'll start out with a pretty lousy quine. This is your last chance to write one yourself, without spoilers!

Did you do it? Great! I hope. I assume. I don't actually know whether you did it. Let's start with the basic Matlab quine.

```matlab
strrep(s = "strrep(s = #, char(35), [char(34), s, char(34)])", char(35), [char(34), s, char(34)])
```

Before I get to explanations, if you want to actually use this code as a string, you'll have to escape the `"` apostrophes to `""`. This would give:
```matlab
>>> code = "strrep(s = ""strrep(s = #, char(35), [char(34), s, char(34)])"", char(35), [char(34), s, char(34)])"
>>> isequal(code, eval(code))

ans = 1
```

You can see that this renders all syntax highlighting void and creates pretty confusing nested strings, so I'll be working with the unescaped non-string versions of the code.

Now, let's discuss what's actually going on here. First, our main character, `strrep`. This is simply a function `strrep(text, search, replace) : string`. It looks for *all* instances of `search` in `text`, and replaces them with `replace`.

Now, what do we replace with what? Well, we search for `char(35)` (`#`). There is only one `#` in our string, and that is where the magic self-reference happens. If you look at our quine, `#` is placed inside the string where the string itself is in the outer code. In other words, inside the string, the text before `#` is the same as the code before the string, and the text after `#` is the same as the code after the string.

The idea is then that we will replace `#` with the string itself, which will then give us our original code.

Now, the rest is scaffolding to make the dream work. For instance, I unsubtly emphasised that `strrep` replaces *all* occurrences of the search string. This means we can't simply put `'#'` as our replace string directly:
```matlab
>>> strrep(s = "strrep(s = #, '#', [char(34), s, char(34)])", '#', [char(34), s, char(34)])

ans = strrep(s = "strrep(s = #, '#', [char(34), s, char(34)])", '"strrep(s = #, '#', [char(34), s, char(34)])"', [char(34), s, char(34)])
```
This just creates a mess, as we also replace our search string; the syntax-highlighter can't even parse this result properly, it's *that* wrong!

For this reason, we write `char(35)` instead of `'#'` in the search string. The *values* are the same, but their *representation* isn't. Quines like to abuse things like this.

Now, we haven't yet discussed what we're replacing our string with, beyond "the string itself". Luckily, in Matlab, this is easy. First, assignments return their own value. This allows us to declare a variable inside a call:
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
Back to our quine. We immediately assign `s` to be our string, so that we can reuse it in the `replace` argument of `strrep`. The syntax `[char(34), s, char(34)]` looks somewhat funky, but all it does is surround `s` with `char(34)` (`"`). This is what we wanted to replace `#` with, so we are done already!

Well, that was easy
===================
Finding quines is not *that* hard, really. It's possible to prove that for *any* program $f$ (we allow for I/O), there exists a program $p_f$ so that "$p_f$ with empty input" and "$f$ fed $p_f$ as input" have the same output behaviour.[^2] More concretely, in what we did above, $f$ is the Matlab interpreter and $p_f$ is our quine.

The proof is even constructive, so there's really no fun in keeping it like this. What's the point of recreational programming if some mathematician gave you the recipe in 19XX already?

There's only one thing we can do in this case. And that's adding an *absolutely dumb* additional restriction so that you truly have a problem no one has ever thought about before.

Let's expand on this `[char(34), s, char(34)]` we saw earlier. In Matlab, vectors and matrices are first-class citizens, with the programming language literally being called "Matrix Laboratory" and all. It has a ton of syntactic sugar when it comes to linear algebra.

One such example is embedding vectors within vectors. You can write `[numberA, vectorB, numberC]`, and then they all get concatenated:
```matlab
>>> a = [1, 2, 3];
>>> [0, a, 4]

ans =

   0   1   2   3   4
```
Now, `char`s are just numbers. And well, if you have a sequence of numbers, calling them a `vector` or a `string`, it's just a matter of interpretation really.
```matlab
>>> [char(72), "ell", char(111)]

ans = Hello
```
As part of the linear algebraic syntactic sugar, Matlab also allows accessing multiple entries at once. (Note that Matlab is 1-indexed.)
```matlab
>>> a = ["a", "b", "c"];
>>> a([3,2])

ans = cb
```
But if both your vectors and your indexers can be strings, what stops you from doing weirder stuff?

```matlab
>>> s = "012345678901234567890123456789012345678901234567890123456789";
>>> s(s)

ans = 789012345678901234567890123456789012345678901234567890123456
```
This looks pretty weird. Converting our characters to ascii, we made a vector `[48, 49, .., 56, 57]`. We then indexed this vector by `[48, 49, .., 56, 57]` again, which indeed gives that result.

Can you see what dumb challenge I'm creating for myself?

Hard mode
=========
We have found a new goal. Find a string `code`, such that:
```matlab
>>> isequal(code, eval(code))

ans = 1

>>> isequal(code, code(code))

ans = 1
```
If you want to try for yourself, I'll spoil one thing: *it's possible*. I don't know if I've emphasised it enough, but it's also *dumb as heck*. If you *legitimately* want to try, **stop scrolling**, as the next code block will contain my solution.  
(Not that a passing glance will help you in any way, shape, or form, but still.)

Let's first reflect a little. Basically every language has a quine[^2]. But when you add extra requirements, you don't have the guarantee that any solution exists. It's just a matter of bashing your head against the wall because it *looks* so possible.

And then, half the time, you're a character short from it being possible. Or so you think. You're not going to get any confirmation, however, because you're not going to spend your time putting your additional dumb restrictions into mathematical proof.

Could you imagine? In this case, in your proof you would have to account for all of ascii, and all of Matlab's little quirks.

My head was sufficiently bashed when I finally found a solution to this dumb problem, so I'm going to guide you through this very ad-hoc thought process.

I think I've rambled enough, and it's safe to put my solution in a code block so that those zero people don't get spoiled.

```matlab
[  ''()*1,-''*123,strrep(s=      "[  ''()*1,-''*123,strrep(s=      D,char(31*3-22-3),[    [,],' a c e  h       p rst'(2)-31-32,s,12*3-2])]",char(31*3-22-3),[    [,],' a c e  h       p rst'(2)-31-32,s,12*3-2])]
```

yeahhh...

This is *more like* what the result of recreational programming tends to look like. Weird whitespace, character sequences that shouldn't be valid in any sane language, magic numbers all over, it's lovely.

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

Fundamentally, it's actually not too different from the basic quine we discussed earlier. The `#` in the basic quine is a `D` in this quine, so you can *actually* see the exact same structure if you try pretty hard. Everything before the `D` is everything before the big string, everything after `D` is everything after the big string.

[/block]

[^1]: Written by Yusuke Endoh, and better known by its Japanese title "あなたの知らない超絶技巧プログラミングの世界". It seems like there's still not an English version out there, unfortunately. I've heard Google Lens is pretty good at translating lately, why don't you try that?
[^2]:
    For those weirdos that studied and even *liked* math, I'll shamelessly yoink the sketch proof from that book and sketchify it even further.

    First, TODO.

{:/nomarkdown}