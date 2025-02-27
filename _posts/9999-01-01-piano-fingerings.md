---
layout: post
title: Fingering piano scores
title-lower: fingering piano scores
title-tiny: piano fingerings
blurb: Brute-forcing what hopefully non-bizarre pose you have to put your hand in to play a chord!
tags: math music optimisation
---
{::nomarkdown}

[block]
I'm honestly surprised I haven't written anything about music on this blog yet! It's a topic near and dear to my heart, and the hobby I spend the second most time on, after programming. These worlds of music and programming sometimes intersect, so it's time to write about it!

My end goal is simple. I start with a bunch of notes, for instance as recorded by a pianist. I want to turn this score into an animation of some 3d model playing these notes, accurately, on a virtual piano. This process takes, _very_ roughly, two steps:
1. Determine what finger plays each note.
2. Then (ab)use [inverse kinematics](https://en.wikipedia.org/wiki/Inverse_kinematics) to actually move virtual limbs the way they should.

This post will be about the first, easier, part. I'll do a write-up of the second part when I've finished working on that. (Knowing me, and how I hop between all of my projects willy-nilly, this might take a while.)

*Note: Scores in this post will be displayed in "piano roll" format. This mimics a real piano, so that anyone can keep up with what's happening, even if they don't know all that much about music. For the more musically inclined, you can switch to sheet music with this neat little button:*

BUTTON

The problem
===========

Suppose you have some melody you want to play on the piano. Let's take *Twinkle Twinkle Little Star* as an example.

IMAGE

While you could play every note on the keyboard with your nose, we're not as creative as Mozart, so we'll need to be using these five[^1] fingers we've all had ever since we were born.

If you assign your thumb the number "1", your index finger the number "2", all the way up to your pinky as "5", we can *finger* scores by assigning each note a number. One might assign *Twinkle Twinkle Little Star* the following fingering:

IMAGE

Alternatively, you could also play it like this:

IMAGE

Both of these fingerings are fairly acceptable. This is important -- there is not a singular "best" fingering, you might have to choose from multiple. But some fingerings are also completely bonkers, with no sane human playing pieces like that:

IMAGE

This fingering is the equivalent of writing "qwerty" with your right hand's pinkie, ring finger, middle finger, index finger, thumb, and thumb again. While you *could* do it, it's awkward, to say the least!

But we're not just fingering simple pieces that play one note at a time, one after the other. Pianists have to deal with much whackier music than this. Take for instance the following passage.

IMAGE

These are two measures of a transcription of *祝彩歌*[^2] ("*Shukusaika*") I've been working on. (This track just *might* be the motivation for this project!) You can see how we play multiple notes at the same time (which constitute a *chord*), and some notes are held while other notes are being pressed and released. We need to deal with all of this!

Finally, we don't just need to finger the right-hand's part, but the left-hand's part as well! I *could* do this neatly, but I won't. I'll just assume both hands' scores are provided separately, and use the right-hand algorithm for the left hand[^3].

Looking around
==============
I'm a pretty lazy fellow. The first thing I do whenever I face a problem like this, is just look if other people have solved it before. Unfortunately (fortunately?) I didn't find something that satisfied me, so I instead decided to roll my own solution, based on two papers, with some mild sauce added on top.

The first paper[^4], "*Finding Optimal Piano Fingerings*", fingers scores that only have one note playing at any given time. In other words, we don't allow chords at all. Its approach is simple: consider the geometry of the piano, and rate the difficulty of everything you could encounter. Take for instance the playing of an octave.

IMAGE

We rate the "natural" option of playing the low note with our thumb and high note with our pinky as "easy". But this "1-to-5" option is just one of many. We also have to rate 2-to-5, 4-to-3, 1-to-1, etc. And octaves are just one of the many intervals we could play. We need to rate *all* other intervals as well, which gives us a large table of data.

The paper chose to rate difficulties on a scale of 1 ("easy") through 4 ("hard"), and also automatically disqualified certain transitions. For instance, using the same finger for two different notes in a row is probably not a good idea! To give you an idea of how much data a table like this holds, let's just commit some plagiarism and include it directly:

IMAGE

These ratings are only for when you start and end on a white key. They have other tables for when you start and/or end on black keys. This makes sense: moving a half step from a white to a black key is pretty different from a half step from a black key to a white key.

With these tables, finding the optimal fingering comes down to assigning fingers to each note, such that each transition between notes is not "too expensive".

IMAGE

The paper implements this efficiently with dynamic programming, but I'm not going to elaborate on that part, as I much prefer the more explicit graph-path-based approach of the second paper.

The second paper[^5] already has an advantage over the first paper if you look at the title: "*A Simple Algorithm for Automatic Generation for Polyphonic Piano Fingerings*". This paper supports polyphony, which means we add chords to our music!

How this paper works, is that every note press corresponds to a layer in a so-called *trellis graph*. In this layer, we enumerate all possible fingerings for all active notes at this time, and connect it to everything in the previous layer. The first two measures of *Twinkle Twinkle Little Star* would give the following graph:

IMAGE

As we only play one note at a time, we have five vertices per layer, one for each finger. But if we look at music with chords, we get larger layers. Take for instance the excerpt from *Shukusaika* earlier. It gives us the following graph:

IMAGE

The paper then assigns weights to each arrow, based on two factors. First, there is the cost of transitioning from the previous hand position to the new hand position. If your hand has to emulate a rollercoaster to move from A to B, you better expect it to be an expensive arrow! But as we support chords, the paper also has a second contribution to the cost. This is the intrinsic cost of playing a chord with a certain fingering. 

You can see it for yourself! If you had to hold down Q, E, and T on your keyboard[^6] with your right hand, what would you do? If you'd choose to start with your pinky on Q, it's nearly impossible to press the other two keys. But on the other hand, holding Q with 2, E with 3, and T with 5 is fairly comfortable.

But then the paper goes on about asking the user a bunch of questions to determine optimal piano fingerings optimal for them specifically. That's a UX nightmare! I'll just be using a predefined table like the first paper.

The mild sauce on top
=====================
There's one key point I disagree on with *both* of the above papers: they don't distinguish playing legato, or not playing legato. When you play *legato*, you start pressing down the next chord before releasing the current chord, while you allow a small gap between the notes otherwise. These two scenario's give very different weights!

What I want to do, is to play in legato for as much as possible. If something is possible under those constraints, it'll be comfortably possible without, so I really want to prioritise it. Meanwhile, if something is hard or impossible to play under legato, it might still be reasonable without, in which case you need the fall-back weights. The only downside is an audible gap, but this is miles better than declaring a piece unplayable!

So this means I'm doubling the amount of hardcoded data. The first paper used 4 tables, so I'd have a grand total of 8 tables, which is not a good look. We can easily go back to four tables with a simple observation, however. Instead of having separate tables "white-to-white", "white-to-black", "black-to-white", and "black-to-back", we can just have tables "white-to-anything" and "black-to-anything". After all, your target is determined by the distance you move.

This has consequences for our trellis graph. As we now have two types of costs between the layers, we can choose to have double the amount of arrows. We could also set the cost on each arrow to the minimum of the two. Or we could double the size of our layers to denote "this fingering, legato with the previous layer" and "this fingering, without legato". I chose the last option, as it was the easiest to visualize when debugging.

Finally, there's some small things I changed. I don't rule out *any* fingerings at first glance, I just rate them prohibitively high. My rating-range is also a little higher to do some micro-tuning. My final weight-ratings can be found in [this](https://docs.google.com/spreadsheets/d/1DyfmfqTCj7CKq8DSQwRYFTWNLFbgQFwHGCxWd9W1p4Y/edit?usp=sharing) sheet, which has a good 2200 weights contained in it. These ratings are my personal opinion I found when experimenting with my piano at home, but they seem pretty decent. I might be biased.

Implementing this
=================
Usually, this is the point in my blogs where I go deep into implementation details. But as this is *yet another* "find a minimum path" algorithm and I've written loads of those already, I just couldn't be bothered. Especially since the bookkeeping this time seemed particularly annoying.

Lately people have been raving about AI when applied to programming, so I wanted to see how good it really was for myself. The full conversation can be found [here](https://gist.github.com/Atrufulgium/d9f333b5cae4dbadc7e7b05a8cc57f3c) if you're interested (I hope not).

In my prompt I was excessively detailed, and specified exactly what I wanted and what I already had. I didn't have *any* clue as to how good AI was, so I also wanted to test it a little. I left out a tiny bit of specification, and asked it to tell me what I left out.

The first implementation ChatGPT gave me was Dijkstra, but I already knew that we could do better. Dijkstra is meant for fairly general graphs, while this graph has a *lot* of structure in there. After telling the AI that
> we're working with an already topologically-sorted DAG, [so] please try not using Dijkstra, but a more efficient algorithm  

it gave the result I actually expected, immediately.

Safe to say, I was floored. It correctly identified what I left out, and gave a mostly-correct implementation. I had to make some small changes to make the code a bit more resilient, and slightly more readable, but it just... worked. When I decided I didn't want to minimize the maximum cost, but sum of costs, it was also way easier than it should've been.

In hindsight, it's pretty obvious as to *why* ChatGPT was actually so good at this. Unlike regular programming, there is barely any relevant context. (And the context it needed was simply given by me.) More importantly, this problem is actually fairly leetcodey, and if there's *one* programming-related niche with a disproportionate number of articles online about it to scrape for training data, it's leetcode.

Many of my subsequent attempts to use AI that either require more context or are not just some self-contained problem, were handled much more poorly. Don't worry, however quickly I was illusioned, I was disillusioned just as quickly.

An eternity nudging costs
=========================
From here on out, I just need to mess with my massive 2200-value table until my results look right. This starts simple: just test each musical scale, both up and down. Easier said than done, however, and in the end I did, like, eight commits of pure weight-nudging...

The first issue is that some situations are *very* subtly different. Take for instance the C-major and F-major scales. The only difference between the two is that the fourth note is a black note a half step down.

IMAGE

Each time I fiddled with parameters to fix some other scale, these two would end up with the same fingering. Sometimes I even had all of the *scales* correct, but my earlier list of *individual chords* suddenly had a failure somewhere. This is why people don't generally make a 2200-value table!

There's also my test that consisted of two octaves of the C-major scale. The canonical way to play *one* octave of the C-major scale has the fingering "123 12345". Going any further than that generally turns the last "5" into a "1" and then repeats the pattern. For example, if you continue four more notes, it should give "123 1234 12345". Well, what does my code do?

IMAGE

This "1234 123 12345" is completely equivalent in difficulty to "123 1234 12345". But it just doesn't sit well with me, it's *wrong*. Eventually I managed to convince myself that I don't care.

The second issue was actually a little unexpected. Just like *Twinkle Twinkle Little Star* is one of the earliest pieces a fledgeling pianist encounters in English spheres, "*Father Jacob*" has this role in the Dutch sphere. Indeed, it was also one of the first pieces I learnt! I just put the fingering I remembered into my test:

IMAGE

And then I called it a day. But... the test didn't pass. It instead gave me the following:

IMAGE

This led me to get distracted with piano pedagogy for a few minutes. The fingering my algorithm returned is certainly the *better* fingering, and the one anyone with some experience would sightread it as. But all resources I could find gave the beginner fingering I also learnt. I get that moving fingers during a "quicker" phrase is perhaps a little more difficult, but I really don't like the "play the same note, first with your pinkie, and then with your ring finger" it's doing. The *Twinkle Twinkle Little Star* sheets I looked at have similarly interesting fingerings.

I would most certainly not make for a good piano tutor!

And then the final issue, which was me just being an empty-brained knucklehead. I didn't want to write out all scaled every test, so I just had a simple and easy helper method, that let me define scales by the number of halfsteps from the tonic.

```diff
    private static void TestMajorDown(byte lowPitch, int[] fingerings)
        => TestCustomScale(lowPitch, new byte[] {
-               12, 11, 9, 7, 5, 4, 3, 0
+               12, 11, 9, 7, 5, 4, 2, 0
            }, fingerings);
```

Really, self? Was I really just testing a completely different scale? *Obviously* stuff goes wrong if you do that! It took embarrassingly long for me to catch this one.

Once all chords and scales were working as I was hoping, it was time to move on to an actual piece of music! I put some in, I wrote some dirty code to visualize the output, and got [this pdf](/resources/images/fingering/祝彩歌.pdf) (150KB very whacky pdf). After carefully checking everything, my test suite grew a bunch again.

IMAGES

It's a never-ending story of "but this could be improved!"[^7], but it's pretty fun to do. I still have a todo-list left, but for the time being I've started with the animation part of the project.

Conclusion
==========
This post really doesn't have much of a moral. Perhaps "AI is sometimes good, maybe"? But I don't really wanna actively promote the use of AI on this blog. I just thought this was a fun journey that managed to combine two of my passions into one project.

One useful lesson is that it might be useful to have someone on call that knows something about what you're programming? If not for my personal experience playing the piano, that 2200-value table would've been impossible to tweak. On the other hand, isn't that a bit of an obvious thing to say?

[/block]

[^1]: My sincere apologies if you were born with less than five fingers on each hand, or lost some somewhere along the way.
[^2]: Niche song from a niche anime (with very whacky timesigs). But I'll never not take the opportunity to say "watch *Prima Doll*"! It be good stuff.
[^3]:
    Of course, I say this, but I need to argue for it as well.

    If you ever so much as glanced at a piano, you'll know that they're pretty symmetric. Take the range from D to the D an octave higher. If you mirror D♯ onto C♯, E onto C, F onto B, etc, you'll change all note values, but the *geometry* of the white and black keys remains unchanged. As we're only using the geometry, we can just mirror the piano, and use the right-hand algorithm. Mirroring back, we get notes compatible with your left hand.

    IMAGE

    Taking a look at the MIDI format, we can see that we *can just do this mirroring*. A standard piano maps to MIDI values 21 through 108, but our algorithm can handle the full range of 0 through 127. We can mirror the entire piano through the middlemost D (MIDI value 62) by computing `mirrored = 124 - value`. We lose three notes this way, but we weren't using them anyways, so that doesn't matter!

[^4]: "*Finding Optimal Piano Fingerings*", M. Hart, R. Bosch, and E. Tsai, The UMAP Journal 21.2, pages 167-177 ([archive link](https://web.archive.org/web/20201219163100/http://web.gps.caltech.edu/~tsai/files/HartBoschTsai_2000.pdf)).
[^5]: "*A Simple Algorithm for Automatic Generation for Polyphonic Piano Fingerings*", A. Kasimi, E. Nicholas, and C. Raphael, Proceedings of the 8th International Conference on Music Information Retrieval, pages 355-356 ([link](https://www.researchgate.net/publication/220723281_A_Simple_Algorithm_for_Automatic_Generation_of_Polyphonic_Piano_Fingerings)).
[^6]: The typing keyboard, not the keyboard keyboard.
[^7]:
    A few obvious things remain unimplemented.
    - Some sheets have you slide a finger from a black note to a white note. This is pretty easy, actually. However, the converse (going from a white note to an adjacent black note with the same finger) is... not. These tables are symmetrical, so this needs to be hardcoded into getting the weights, which I haven't got around to yet.
    - Glissando's are completely unimplemented, and it just tries to finger them as if they are a quickly-played scale. This is very suboptimal! I should probably detect glissando's, and remove them from the score to handle separately.
    - My algorithm does not have any tie-breaking mechanism, which is a little annoying. One clear tie-breaking mechanism is "just use the previous finger this note used", which *very often doesn't happen*. Because I don't have a tie-breaking mechanism. Whoops.
    - When pianists play the same note repeatedly, and *quickly*, they switch between fingers. My algorithm doesn't do that.
    - In general, this entire thing is time- and octave-unaware. I have a preprocessing pass that separately fingers individual parts of the score if there is a suitable gap, but other than that? Nothing. Similarly, playing at the edges of the piano or the centre doesn't affect fingerings at all.

    So yeah, still quite a bit of work left!

{:/nomarkdown}