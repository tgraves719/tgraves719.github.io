---
layout: base.njk
title: Home
---
<h1 class="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight uppercase" style="letter-spacing: 0.05em;">Thomas J Graves</h1>
<p class="max-w-3xl mx-auto mt-6 text-lg text-gray-300">I build computational models of human practices — a jazz performance, a union contract, a colonial print register — and study what the model does to the practice, and whom the resulting system serves.</p>
<p class="max-w-3xl mx-auto mt-4 text-gray-400">Musician and developer. Currently: an open-source contract assistant piloting with UFCW Local 7, and three published years of the imperial print register of British Punjab.</p>
<a href="/research/" id="reality-engine-btn" class="sound-interactive interactive-rainbow inline-block mt-10 px-8 py-4 text-lg font-bold uppercase tracking-wider rounded-lg transition-all duration-300 hover:scale-105">
  The Research
</a>

<div class="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20 text-left p-2">
  {%- for s in sites %}
  <a href="/research/" class="card static-rainbow bg-[var(--color-bg-card)] rounded-xl p-6 flex flex-col transition-transform duration-300 hover:-translate-y-1">
    <p class="text-gray-500 uppercase tracking-wider text-xs mb-2">{{ s.mode }}</p>
    <h2 class="text-xl font-bold text-white uppercase tracking-wide mb-3">{{ s.title }}</h2>
    <p class="text-gray-400 text-sm">{{ s.line }}</p>
  </a>
  {%- endfor %}
</div>
