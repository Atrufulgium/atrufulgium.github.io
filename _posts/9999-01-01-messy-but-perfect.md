---
layout: post
title: A hack that's gone 10'000 hours without a hitch
title-lower: a hack that's gone 10'000 hours without a hitch
title-tiny: sturdy hack
blurb: A piece of pretty bad one-off code that's run for years with no problems.
---
{::nomarkdown}

[block]
Time for a quickie, because I *really* need to emphasise the moral of this story to myself, right now.

I'm a bit of a perfectionist. No, scratch that, I'm very much a perfectionist. They say "Don't let 'perfect' be the enemy of 'good'", but I'm very much that kind of person.

This post is about the *one* time I *was* satisfied with "good", and how the resulting -- crappy -- code has run without problems for years.

A very trivial problem
======================
First I'll have to lay down the context, I guess.

I'm a bit of a nut when it comes to music. I meticulously tag all metadata, order it nicely, all of that jazz. Like all proper music nuts, I'm using a wonderful piece of software called "[foobar2000](https://www.foobar2000.org/)". On top of that, I'm using a [plugin](https://www.foobar2000.org/components/view/foo_deskband_controls) that also gives me a miniplayer on my taskbar.

[display-image]
[![A screenshot of my taskbar with a small music player on it.](/resources/images/perfectionism/deskband1.png)][hover-deskband1]

[hover-deskband1]: ## "This is a good track, btw."

[/display-image]

Now, I am a big fan of customisation. I ended up deciding I want to make the colour of the seek bar change depending on the genre of the current track. Just a small bit of flair, nothing too big.

[display-image]
[![Multiple screenshot of the music player, the seek bar having different colours each time.](/resources/images/perfectionism/deskband2.png)][hover-deskband2]

[hover-deskband2]: ## "This is a good track, btw.&#013;This is a good track, btw.&#013;This is a good track, btw.&#013;This is a good track, btw."

[/display-image]

Chiptune would be purple, orchestral would be green, jazz would be brown, and so on[^1]. However, there's one problem: I don't have source access to the taskbar player.

A normal person would just ask for it, first.

I'm not a normal person, and decided to have some fun hacking around a black box.

A very trivial solution
=======================
My first attempt was to locate the colour inside the process's memory with [Cheat Engine](https://www.cheatengine.org/), and write to it. Finding the colours in memory was not too hard, actually[^2].

[display-image]
[![Screenshot of the location of one of the colours in "explorer.exe"'s memory.](/resources/images/perfectionism/cheat-engine.png)][hover-cheat-engine]

[hover-cheat-engine]: ## "This is tracks."

[/display-image]

But as you can see in the screenshot, the colour is stored in `explorer.exe`'s memory. Apparently, this foobar2000 plugin is implemented as what's called a "shell extension" of Windows Explorer. I don't know much about this, but I *do* know I'm not comfortable writing to *Windows Explorer's raw memory*. That's bound to go all kinds of wrong[^3]. So, time to try something else.

The plugin saves all of its formatting information to a data file, which includes the colours. After messing around for a bit, I found out that this file is read *every second*, no matter what. Well, this makes updating colours easy! Just write the colours to that file, and the rest of the job is done for us.

However, this is only half of the puzzle, since I still need to find out the genre of the current track. Again, I have two options. I *could* use foobar2000's SDK to do the job. Or, again, I could do something silly.

I went for the silly option. You see, I already format foobar2000's window title to include any data I could possibly want with the built-in options: `title (author) - original track if it's a remix <genre>`. So let's just regex the `genre` out of this title!

A very trivial piece of code
============================
Now it's time to do the actual programming part. The worst part of the project is all the constant data we'll need to keep track of.
```csharp
// The process name we use to get the handle.
static readonly string FoobarProcessName = "foobar2000";
// The location of the data file.
static readonly string ConfigPath = @"C:\[..]\DeskbandControls.json";
// The offset, in bytes, of where in the file the two colours are
// stored.
static readonly int FGColorLocation = 2090;
static readonly int BGColorLocation = 2129;
```
Here you can already see a bunch of bad ideas you wouldn't wanna put in code that runs for years.
- We hardcode the process name, but what if it updates? Not too likely a scenario, but ideally, you'd take this into account.
- We hardcode the location of the data file. This is including my Windows username! Change that, and this thing breaks. Absolutely awful.
- You may notice that the data file is a `json` file. This is another hacky decision: I didn't want to create a proper schema for the data file (which would've been a guesstimate anyways), so I just write into a *hardcoded offset*. I can't emphasise enough how bad of an idea this is.

Four lines in, and I've already had to complain about a bunch! The entire file is 400 lines long, so imagine how bad it gets! That's another thing, the entire program is just one file with no proper architecture, no tests, no nothing.

A bit earlier I wrote how I'm searching for the genre with a regex. Because really, that's the obvious thing to do. Apparently, I misremembered, and I'm doing it manually.

```csharp
// Search for the leftmost '<' in the title.
int index = 0;
for (; index < title.Length; ++index) {
    if (title[index] == '<')
        break;
}
...
```
I guess there better be no tracks with a `<` in the title or album name, or the colouring fails! But it also reinforces the point of this post that I *did not notice this all these years*, so this is definitely "good enough".

The list of genres and their colours is also hardcoded and not delegated to some config file. This is actually the *only* thing that I've run into and wanted to change a few times. It seems like a pile of hacky decisions like this isn't infallible, who'd've thought?

But not every decision I've made is bad. There's also key points where I actually put in effort -- to get a "good enough", there needs to be at least some "good", after all.

First, I did the thing where only one instance may exist at a time. Having multiple version of this program reading titles or writing colours makes no sense, and can only result in problems.

```csharp
bool exists = Process.GetProcessesByName(
    Path.GetFileNameWithoutExtension(
        System.Reflection.Assembly.GetEntryAssembly().Location
    )
).Length > 1;

if (exists) {
    Environment.Exit(0);
}
```

Next, there is the obvious problem of the plugin reading the file every second. There's a decent change me writing to that file will actually clash with that. But doing this check *properly* is a pain, so I'm just busy-waiting until I can write.

```csharp
Stopwatch time = Stopwatch.StartNew();
while (time.ElapsedMilliseconds < 1000) {
    try {
        using BinaryWriter writer
            = new(File.OpenWrite(ConfigPath), Encoding.UTF8);
        writer.Seek(FGColorLocation, SeekOrigin.Begin);
        ...
        break;
    } catch (IOException) { }
}
```
Busy-waiting is frowned upon, but hey, it works. I didn't promise *proper* code in this post, after all!

Finally, I took into account the case where there's no (known) genre found at all, with a fall-back colour. It's a simple thing, but this fallback is called every time I'm playing something I've yet to fix the metadata of. This pile of trash might've actually crashed if I didn't do this!

A trivial conclusion
====================
I'm not telling you to write code like this. Far from it.

But, sometimes, you need to accept that something is "good enough". This program was written over 5 years ago, and has run whenever my laptop's turned on. And I've never had to think about it. Despite the patched-together nature of its code, it just kept on chugging without running into issues. It even survived a migration from laptop A to laptop B, no problem! I can only guess how long this has been running, but it's definitely somewhere between 10k and 25k hours.

Sometimes, you don't need to over-engineer something, sometimes you don't need to deal with all edge-cases. Sometimes, your assumptions really keep holding true for longer than you'd think. Those lucky moments do actually happen. Only while writing this post did I realise that if I gave my new laptop a different username, this thing would've broken. Only while writing this post did I realise that music tracks with a `<` in the title break things. *After over five years.*

Definitely "good enough"-material.

I just need to make myself realise this more often. A lot of time, my side projects don't get finished because I get bogged down in the details. It really says something when the only other things I can actually call "finished" in some respect are my game-jam entries. And those have a similar level of code quality to this thing!

Just, uhh, whenever you decide that an edge-case is not worth your time... Please document it? Comment it, make it throw a clear error? Just to save future-self some trouble when the edge-case suddenly *does* become worth it, make it easy to spot.

[/block]

[^1]: No, this is not synaesthesia, this just makes sense.
[^2]: There's probably a better way than spam `Scan type: Changed value` and `Scan type: Unchanged value` over and over, but it doesn't take *that* many iterations in a perfectly controlled environment like this[^2b].
[^3]: It's probably also not a consistent location in memory, and instead differs each time I start up foobar2000. Working around this is not too difficult -- write a few random magic values and search for them until only one candidate is remaining. Still, a pain.
[^2b]:
    Wow, footnotes within footnotes, how improper! Anyways, time for a bit of a tangent: less controlled environments. For instance, video games!

    Imagine you're fighting an enemy, and want to practice its hardest attack. Ideally, you'd just want to modify the assembly in memory so that it automatically does this attack. The first step is to do scans until you only have a few locations in memory that seem correlated to this attack. Luckily, Cheat Engine allows you to freeze and unfreeze the application in question with a hotkey, so it's not *too* difficult to do, but still a bit of a pain.

    After this, it's time to test. What happens if you mess with those memory values? Can you get a consistent result? This is such a high level of trial-and-error, but I find it pretty fun actually. I *did* make the game crash over and over, but eh. That's to be expected.

    And then, after all the trial and error, you end up only having to update a *tiny* portion of memory to make the game think it should do that attack.
    ```nasm
    ; Before @th15.exe+2EAF9
            mov               eax, [ecx+00005180]
    ; After  @th15.exe+2EAF9
            mov               eax, 000000FF
            nop
    ```
    It's almost insulting how all of that effort results in a total of four updated bytes. But hey, it works, and now I can practice that hardest attack without having to install any mods!

{:/nomarkdown}