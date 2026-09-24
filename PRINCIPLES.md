# Design principles

This site is built against Stephen Sondheim's three principles, which he credited to
Oscar Hammerstein II and set at the front of *Finishing the Hat*:

> **Content dictates form.**
> **Less is more.**
> **God is in the details.**
>
> *All in the service of clarity, without which nothing else matters.*

They are not decoration on a preference. They are a test, and the last line is the one
that adjudicates the other three. Below is what each one means here, and where each one
has already caught something.

---

## 1. Content dictates form

The form of a page is not chosen and then filled. It is derived from what the page has to
say. A song exists in a musical because the emotion has outgrown speech; an effect exists
on this site because the content is that effect.

**What it means here**

- The site says one question is asked in three places, so the structure *is* three places
  — not a flat list of projects with the question in a paragraph above it.
- The particle field and the audio engine are the *instrument*. They belong where the
  content is the instrument: the home page, the music page, the project pages for the
  audiovisual work. An argument does not get a particle field.
- Every project record states what it **inherits** and what it **refuses**, because the
  claim this work makes is that a system is defined by both. The data model carries that
  claim; it is not a rhetorical flourish in a bio.

**Where it caught something**

Three.js and Tone.js were loading on every page, including four thousand words of
research prose. Removing them from text pages exposed that `waitForLibraries()` polled
forever if the libraries were absent — which meant the navigation, the mobile menu and
the rainbow borders were all downstream of a WebGL library on a page with no graphics.
The principle found a structural dependency, not just a weight problem.

---

## 2. Less is more

The reader completes the thought. Saying the thing once, in the fewest words that still
carry it, is stronger than saying it three ways — and what you leave out is as designed
as what you keep.

**What it means here**

- One idea per block. If two sentences make the same point, the weaker one goes.
- No section exists to prove effort. A project page that says everything says nothing,
  because the reader cannot tell what mattered.
- Cards carry what a reader needs in order to decide whether to follow the link, and
  stop. The full argument is one click away, and being one click away is not a failure.
- Nothing is listed twice. If the strand heading says *The Archive*, the card underneath
  it does not also say *archives*.

**Where it caught something**

The home page said the same thing three ways: an abstract claim, a credentials line, and
three cards. Thomas cut it to the claim and the question. The cards now carry the proof,
and the question is the last thing read before the click.

---

## 3. God is in the details

The difference between the right word and the almost-right word is the whole
difference. Details are not polish applied at the end; they are where the work is
either honest or not.

**What it means here**

- Alt text describes what is actually in the photograph. A caption that says *picket
  line* over a photograph of a store interior is a small lie, and small lies are how a
  portfolio stops being trustworthy.
- A status is a field with a fixed vocabulary — *In progress*, *Preserved, not
  maintained*, *Published*, *Next* — so a reader knows what they are looking at without
  being told a story about it.
- Titles are named, not linked, until the thing they name can actually be opened.
- No console narration. A reader who opens developer tools on this site finds it quiet.
- American spelling in the site's own copy — *color, labor, normalize* — because the
  work is American and so is its reader; a union page that says *labour* reads as
  written by someone else. Quotations keep their source's spelling, and a vendored
  instrument keeps its own.

**Where it caught something**

The old home page's headline button read *Enter (Coming Soon to WebXR)* — a control that
looked live and was not. That is the specific failure this site exists to stop repeating,
and it is now a rule: **no control that implies a capability the page does not have.**
The sound toggle is not rendered at all on pages that cannot make sound.

---

**Where it caught something, again — Portraits of Change**

The page is the recital program, because the recital already had a form: twelve pieces
walking once around the color wheel, five ensembles, a stage plot for each. Quotations
are verbatim from the 2021 research portfolio, misspellings included. Laying the data
beside the drawings exposed two things the prose never said: the brass quintet had five
players and four converters, so the trombone was never heard; and Appendix B and the
stage plot disagree about which Bitches Brew instruments were tracked. The first is now
on the page as a finding. The second is shown as a disagreement rather than silently
resolved — the same rule the Punjab pipeline follows for the imperial register.

---

## All in the service of clarity

The adjudicating test. When two principles disagree — when *less is more* wants a
sentence gone and *content dictates form* wants it kept — clarity decides.

**The operative version for this site:** a reader has about ninety seconds. In that time
they should be able to say what Thomas does, what he has actually built, and what he
would research next. If a change makes the site more beautiful and that answer less
available, the change is wrong.

Three corollaries, taken from how Sondheim wrote for an audience that hears a lyric once
and cannot rewind it:

1. **A page is scanned, not read.** Front-load. The first seven words of every section
   carry it, because they may be the only seven read.
2. **Say it once, in the open.** No claim that depends on the reader having already read
   another page. Every page states its own premise in its own words.
3. **Repetition is structure.** The repeated shape — line, inherits, refuses, status — is
   this site's rhyme scheme. It teaches the reader what to expect, which is what makes a
   departure from it mean something.

---

## Two rules that follow from all of this

### Voice is lowercase; the record is sentence case

Where Thomas speaks as himself — the home page, About, the essays introduction, an
essay's own prose — the text is lowercase. Where the site documents work for someone
who has to evaluate it — project cards, the research case studies, the blog, error
pages — it is sentence case.

This is content dictating form at the level of the letter: the two registers are doing
different jobs, and the reader can feel which one they are in before reading a word.
Proper nouns keep their capitals in both, because clarity adjudicates and *ufcw local 7*
costs more than the effect is worth. What is not allowed is the third thing — lowercase
applied unevenly across pages of the same kind, which reads as an accident rather than a
choice.

### Essays argue; the blog records

They are separate collections, not one collection with a filter. An essay is an argument
its author is willing to be wrong about in public; a blog post is what was built, when,
and what broke. The old site had both under a `contentType: essay` tag, which is how a
56-word photo caption came to sit beside a history of jazz innovation.

Consequences, in force:

- **The early writing stays in the record.** Three 2019–2022 pieces are tagged as essays
  in the blog. They are not promoted into the essays section, because a section whose
  first item is 56 words teaches the reader what to expect from the rest of it.
- **An essay may become a video essay.** `videoId` in front matter puts the video above
  the text on the same page — the same argument in another medium, not a second work.
  Until that field is filled, the page says nothing about video at all.
- **What is coming is listed, and unlinked.** Forthcoming essays appear with a status and
  a statement of what each is waiting on. They are not cards, because they are not
  clickable, and a reader must be able to tell an intention from a promise.

---

## What these principles have not yet been applied to

Kept visible rather than quietly deferred:

- **Tailwind is loaded from a CDN**, which warns in the console and ships far more CSS
  than the site uses. A build step is the fix.
- **`_includes/base.njk` is one 97 KB file** — layout, styles, the audio engine, the
  particle field and the navigation. Content dictating form would split it.
