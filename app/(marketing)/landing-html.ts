// Landing page markup, kept as HTML so the design can be edited in one place.
export const LANDING_HTML = String.raw`<header>
  <div class="wrap">
    <a class="logo" href="#top" aria-label="mnu.digital home"><img src="/assets/mnu-logo.png" alt="mnu.digital"></a>
    <nav>
      <a class="link" href="#live">Live demo</a>
      <a class="link" href="#how">How it works</a>
      <a class="link" href="#features">Features</a>
      <a class="link" href="#pricing">Pricing</a>
      <a class="link" href="#faq">FAQ</a>
      <a class="login" href="/login"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="7" r="3.5"/><path d="M3.5 17.5c1-3.2 3.5-5 6.5-5s5.5 1.8 6.5 5"/></svg><span>Log in</span></a>
      <a class="btn btn-sm" href="/signup">Start for Free</a>
    </nav>
  </div>
</header>

<main id="top">
  <!-- Hero -->
  <section class="hx">
    <div class="wrap">
      <div class="hx-card">
        <div class="hx-copy">
          <span class="pill"><i></i>QR menus · no app needed</span>
          <h1>Your menu, <span>beautifully digital</span></h1>
          <p class="hx-lead">Guests scan, browse and order from a menu that looks as good as your food. You update dishes and prices from your phone.</p>
          <div class="stats"><span><b>24h</b>to go live</span><span><b>3</b>languages</span><span><b>0</b>reprints</span></div>
          <div class="ctas">
            <a class="btn" href="/signup">Start for Free</a>
            <a class="btn ghost" href="#live">Try the live demo</a>
          </div>
        </div>
        <div class="hx-visual" aria-hidden="true">
          <div class="halo"></div>
          <div class="tab"><div class="tab-screen">
            <div class="tab-side"><img src="/assets/mnu-logo.png" alt=""><span class="on">Menu</span><span>Categories</span><span>Photos</span><span>Translations</span><span>QR codes</span><span>Settings</span></div>
            <div class="tab-main">
              <div class="tab-top"><b>Dinner menu</b><i>+ Add dish</i></div>
              <div class="tab-kpis"><div><small>Menu views today</small><strong>1,284</strong><em>+12%</em></div><div><small>Dishes live</small><strong>42</strong></div><div><small>Languages</small><strong>3</strong></div></div>
              <div class="tab-rows">
                <div class="tab-row"><img src="/assets/food/salad-sq.jpg" alt=""><div><b>Goat cheese salad</b><small>Starters</small></div><em>$16</em><s></s></div>
                <div class="tab-row"><img src="/assets/food/bread-sq.jpg" alt=""><div><b>Sourdough &amp; dips</b><small>Starters</small></div><em>$12</em><s></s></div>
                <div class="tab-row"><img src="/assets/food/salmon-sq.jpg" alt=""><div><b>Grilled salmon</b><small>Mains</small></div><em>$29</em><s></s></div>
                <div class="tab-row off"><img src="/assets/food/fries-sq.jpg" alt=""><div><b>Crinkle fries</b><small>Sold out</small></div><em>$9</em><s></s></div>
                <div class="tab-row"><img src="/assets/food/espresso-sq.jpg" alt=""><div><b>Espresso</b><small>Coffee</small></div><em>$4</em><s></s></div>
              </div>
            </div>
          </div></div>
          <svg class="leaf l1" viewBox="0 0 60 30"><path d="M2 15C14 0 44 0 58 15 44 30 14 30 2 15z"/><path d="M4 15h50" class="vein"/></svg>
          <svg class="leaf l2" viewBox="0 0 60 30"><path d="M2 15C14 0 44 0 58 15 44 30 14 30 2 15z"/><path d="M4 15h50" class="vein"/></svg>
          <svg class="leaf l3" viewBox="0 0 60 30"><path d="M2 15C14 0 44 0 58 15 44 30 14 30 2 15z"/><path d="M4 15h50" class="vein"/></svg>
          <div class="qr-badge"><canvas class="qr" width="25" height="25"></canvas>SCAN ME</div>
          <div class="phone"><div class="screen">
            <div class="ph-photo"><img src="/assets/food/salad-sq.jpg" alt=""></div>
            <div class="ph-body">
              <b>Goat cheese salad</b>
              <p>Frisée, walnuts, crumbled goat cheese, balsamic</p>
              <div class="ph-lbl">Allergens</div>
              <div class="ph-dots"><i>D</i><i>N</i><i>V</i></div>
              <div class="ph-btn">Add to order · $16</div>
            </div>
          </div></div>
        </div>
        <div class="minis" aria-hidden="true">
          <div class="mini"><div><b>Sourdough &amp; dips</b><small>Updated 2 min ago</small><em>$12</em></div><img src="/assets/food/bread-sq.jpg" alt=""></div>
          <div class="mini"><div><b>Grilled salmon</b><small>Chef's pick</small><em>$29</em></div><img src="/assets/food/salmon-sq.jpg" alt=""></div>
          <div class="mini"><div><b>Crinkle fries</b><small class="out">Sold out tonight</small><em>$9</em></div><img src="/assets/food/fries-sq.jpg" alt=""></div>
          <div class="mini"><div><b>Espresso</b><small>New roast</small><em>$4</em></div><img src="/assets/food/espresso-sq.jpg" alt=""></div>
        </div>
      </div>
    </div>
  </section>

  <!-- Live demo -->
  <section class="block" id="live">
    <div class="wrap">
      <div class="head">
        <span class="pill"><i></i>Live demo</span>
        <h2>Change it here. See it there.</h2>
        <p>This is the mnu.digital dashboard. Change a price, mark a dish sold out or switch language, and watch the guest's phone update.</p>
      </div>
      <div class="demo">
        <div class="panel glass spot">
          <div class="panel-top">
            <div><h3>Olive &amp; Salt · Menu</h3><small>Dinner menu · 5 dishes</small></div>
            <div class="seg" role="group" aria-label="Guest language">
              <button type="button" data-lang="en" aria-pressed="true">EN</button>
              <button type="button" data-lang="he" aria-pressed="false">עב</button>
              <button type="button" data-lang="ar" aria-pressed="false">عر</button>
            </div>
          </div>
          <div class="rows" id="rows"></div>
          <div class="panel-foot"><i></i><span id="sync">All changes are live</span></div>
        </div>
        <div class="demo-phone">
          <div class="phone"><div class="screen">
            <div class="venue"><small>RESTAURANT · BAR</small><b>Olive &amp; Salt</b></div>
            <div class="g-list" id="guest"></div>
          </div></div>
        </div>
      </div>
    </div>
  </section>

  <!-- Photo marquee -->
  <section class="block" id="showcase" style="padding-top: 0">
    <div class="wrap">
      <div class="head">
        <h2>Menus that make people hungry</h2>
        <p>Full-size photos, clear prices, every dish in your guest's language.</p>
      </div>
    </div>
    <div class="marquee"><div class="track" id="track"></div></div>
  </section>

  <!-- Steps -->
  <section class="steps-band" id="how">
    <div class="wrap">
      <div class="steps-head">
        <h2>Live in<br>four steps</h2>
        <p>From a printed card to a live menu, usually within a day. No designer, no developer.</p>
      </div>
      <ol class="flow">
        <li><span class="num">01</span><div class="flow-pic"><img src="/assets/food/bread.jpg" alt=""></div><h3>Photograph your menu</h3><p>Snap the printed menu or send a PDF. We pull in every dish and price.</p></li>
        <li><span class="num">02</span><div class="flow-pic swatch-pic"><span style="background:#6f9393"></span><span style="background:#f2f1eb"></span><span style="background:#363d41"></span><span style="background:#d2b49b"></span></div><h3>Choose a style</h3><p>Match the menu to your logo, colours and fonts.</p></li>
        <li><span class="num">03</span><div class="flow-pic"><img src="/assets/food/salmon.jpg" alt=""></div><h3>Add photos</h3><p>Upload your own dish photos, or keep it text-only.</p></li>
        <li><span class="num">04</span><div class="flow-pic qr-pic"><canvas class="qr" width="25" height="25"></canvas></div><h3>Place the QR code</h3><p>Put it on the tables. Every edit is live for guests right away.</p></li>
      </ol>
    </div>
  </section>

  <!-- Features -->
  <section class="block" id="features">
    <div class="wrap">
      <div class="head">
        <h2>Less printing, more control</h2>
        <p>Everything a venue needs to run its menu, and nothing it doesn't.</p>
      </div>
      <div class="bento">
        <div class="tile glass spot t-lang">
          <h3>Speaks your guest's language</h3>
          <p>English, Hebrew, Arabic and more in one menu. Guests pick their language and the layout flips right-to-left where it should.</p>
          <div class="cycle"><span class="word" id="word">Grilled salmon</span><small id="word-lang">English</small></div>
        </div>
        <div class="tile glass spot t-sold">
          <h3>Sold out? One tap.</h3>
          <p>Grey out a dish the moment the kitchen runs out.</p>
          <div class="sold-demo"><img src="/assets/food/fries-sq.jpg" alt=""><div><b>Crinkle fries</b><span class="a">Available</span><span class="s">Sold out</span></div></div>
        </div>
        <div class="tile glass spot t-qr">
          <h3>One QR, forever</h3>
          <p>Print it once. The menu behind it changes as often as you like.</p>
          <div class="qr-big"><canvas class="qr" width="25" height="25"></canvas></div>
        </div>
        <div class="tile glass spot t-allergen">
          <h3>Allergens at a glance</h3>
          <p>Clear labels next to every dish, in every language.</p>
          <div class="chips"><span>Vegan</span><span>Gluten-free</span><span>Contains nuts</span><span>Dairy</span><span>Spicy</span></div>
        </div>
        <div class="tile glass spot t-brand">
          <h3>Your brand, not ours</h3>
          <p>Your logo, colours and fonts, so the menu feels like part of the room.</p>
          <div class="swatches"><i style="background:#6f9393"></i><i style="background:#f2f1eb"></i><i style="background:#3a2a21"></i><i style="background:#c9b089"></i></div>
        </div>
      </div>
    </div>
  </section>

  <!-- Pricing -->
  <section class="block" id="pricing" style="padding-top: 40px">
    <div class="wrap">
      <div class="pricing">
        <img class="float-plate fp1" src="/assets/food/salad-sq.jpg" alt="" aria-hidden="true">
        <img class="float-plate fp2" src="/assets/food/espresso-sq.jpg" alt="" aria-hidden="true">
        <div class="pricing-copy">
          <span class="pill"><i></i>Pricing</span>
          <h2 style="margin-top: 18px">Turn your menu digital <span>in minutes.</span></h2>
          <p>Try everything free for 7 days. Then one simple plan at $39 a month.</p>
          <ul class="perks"><li>All features from day one</li><li>Cancel anytime before day 7, pay nothing</li><li>Live in under 24 hours</li></ul>
        </div>
        <div class="plan">
          <div class="plan-name"><h3>Free trial</h3><span class="tag-pill">Start here</span></div>
          <div class="plan-price"><sup>$</sup><b>0</b><small>for 7 days</small></div>
          <p class="plan-sub">Full access while you set up and test.</p>
          <ol class="trial-line">
            <li><b>Today</b><span>Sign up, add your card and build your menu</span></li>
            <li><b>Days 1–7</b><span>Take real orders, print your QR codes</span></li>
            <li><b>Day 7</b><span>First charge of $39, then monthly</span></li>
          </ol>
          <a class="btn" href="/signup">Start for Free <i>→</i></a>
        </div>
        <div class="plan dark">
          <div class="plan-name"><h3>mnu.digital Pro</h3><span class="tag-pill">One plan</span></div>
          <div class="plan-price"><sup>$</sup><b>39</b><small>/month</small></div>
          <p class="plan-sub">Everything included, per venue.</p>
          <ul>
            <li>Unlimited dishes, photos and views</li>
            <li>Table and takeaway ordering</li>
            <li>QR codes for every table</li>
            <li>AI dish descriptions, 1,000 a month</li>
          </ul>
          <div class="plates" aria-hidden="true"><img src="/assets/food/bread-sq.jpg" alt=""><img src="/assets/food/salmon-sq.jpg" alt=""><img src="/assets/food/fries-sq.jpg" alt=""><span>Restaurants, cafés, bars &amp; hotels</span></div>
          <a class="btn" href="/signup">Start free trial <i>→</i></a>
        </div>
      </div>
    </div>
  </section>

  <!-- FAQ -->
  <section class="block" id="faq" style="padding-top: 40px">
    <div class="wrap faq-split">
      <div class="faq-side">
        <span class="pill"><i></i>FAQ</span>
        <h2>Questions, answered</h2>
        <p>Can't find what you're looking for? We're happy to walk you through it.</p>
        <a class="btn ghost" href="#contact">Ask us anything</a>
      </div>
      <div class="faq-lines">
        <details open><summary><span>01</span>What is mnu.digital?</summary><p>A digital menu service for restaurants, cafés, bars and hotels. Guests open your menu by scanning a QR code, and you manage it from any device.</p></details>
        <details><summary><span>02</span>Do guests need to install an app?</summary><p>No. The menu opens in the phone's browser as soon as the code is scanned.</p></details>
        <details><summary><span>03</span>Can I update the menu myself?</summary><p>Yes. Prices, dishes, photos and availability can all be changed from your phone, and guests see the change right away.</p></details>
        <details><summary><span>04</span>Which languages are supported?</summary><p>English, Hebrew and Arabic out of the box, with right-to-left layouts. More languages can be added.</p></details>
        <details><summary><span>05</span>How does the free trial work?</summary><p>You get 7 days with every feature. A card is needed to start, and the first $39 charge happens on day 7. Cancel in Settings before then and you pay nothing.</p></details>
      </div>
    </div>
  </section>

  <!-- Contact -->
  <section class="cta-band" id="contact">
    <div class="wrap cta-grid">
      <div class="cta-copy">
        <h2>See your own menu on mnu.digital</h2>
        <p>Create your digital menu in minutes. Free for 7 days, then $39 a month.</p>
        <div class="cta-actions">
          <a class="btn cta-btn" href="/signup">Start for Free <i>→</i></a>
          <span class="cta-note">Live in under 24 hours</span>
        </div>
        <div class="cta-photos" aria-hidden="true">
          <img src="/assets/food/salad-sq.jpg" alt=""><img src="/assets/food/salmon-sq.jpg" alt=""><img src="/assets/food/espresso-sq.jpg" alt="">
        </div>
      </div>
      <div class="cta-phones" aria-hidden="true">
        <div class="phone back"><div class="screen">
          <div class="ph-photo"><img src="/assets/food/salmon-sq.jpg" alt=""></div>
          <div class="ph-body">
            <b>Grilled salmon</b>
            <p>Lemon, dill, olive oil, seasonal greens</p>
            <div class="ph-lbl">Allergens</div>
            <div class="ph-dots"><i>F</i><i>G</i></div>
            <div class="ph-btn">Add to order · $29</div>
          </div>
        </div></div>
        <div class="phone front"><div class="screen">
          <div class="venue"><small>RESTAURANT · BAR</small><b>Olive &amp; Salt</b></div>
          <div class="cta-chips"><span class="on">Starters</span><span>Mains</span><span>Coffee</span></div>
          <div class="g-list">
            <div class="g-item"><img src="/assets/food/bread-sq.jpg" alt=""><div><b>Sourdough &amp; dips</b><p>Warm sourdough, tahini, tomato salsa</p></div><em>$12</em></div>
            <div class="g-item"><img src="/assets/food/salad-sq.jpg" alt=""><div><b>Goat cheese salad</b><p>Frisée, walnuts, balsamic</p></div><em>$16</em></div>
            <div class="g-item"><img src="/assets/food/fries-sq.jpg" alt=""><div><b>Crinkle fries</b><p>Sea salt, chipotle aioli</p></div><em>$9</em></div>
            <div class="g-item"><img src="/assets/food/espresso-sq.jpg" alt=""><div><b>Espresso</b><p>Single origin, double shot</p></div><em>$4</em></div>
          </div>
        </div></div>
        <div class="scan-chip"><canvas class="qr" width="25" height="25"></canvas><span>Scan to<br>see the menu</span></div>
      </div>
    </div>
  </section>
</main>

<footer>
  <div class="wrap foot-grid">
    <div class="foot-brand">
      <a class="logo" href="#top" aria-label="mnu.digital home"><img src="/assets/mnu-logo.png" alt="mnu.digital"></a>
      <p>Digital menus for restaurants, cafés, bars and hotels.</p>
    </div>
    <div><b>Product</b><a href="#live">Live demo</a><a href="#features">Features</a><a href="#pricing">Pricing</a></div>
    <div><b>Company</b><a href="#how">How it works</a><a href="#faq">FAQ</a><a href="#contact">Contact</a></div>
  </div>
  <div class="wrap foot-base"><span>© 2026 mnu.digital. All rights reserved.</span><a class="to-top" href="#top">Scroll to top <i>↑</i></a></div>
</footer>`;
