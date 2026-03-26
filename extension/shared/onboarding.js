export function checkOnboarding() {
  if (localStorage.getItem('drift_onboarded')) return;
  showOnboarding();
}

function showOnboarding() {
  const steps = [
    {
      title: 'Welcome to Drift',
      body: 'Drift watches where your attention actually goes — and reflects it back honestly. No blocking. No judgment. Just clarity.',
      btn: 'next →'
    },
    {
      title: 'Set your intention',
      body: 'Every time you open a new tab, type what you\'re here to do. That single moment of intention is the whole product.',
      btn: 'next →'
    },
    {
      title: 'See the river',
      body: 'When your session ends, Drift renders a river map — a beautiful visual of where your attention actually went. Export it. Learn from it.',
      btn: 'got it →'
    }
  ];

  let current = 0;

  const overlay = document.createElement('div');
  overlay.id = 'drift-onboarding';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;
    display:flex;align-items:center;justify-content:center;
    animation:driftFadeIn 0.4s ease;
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    background:#1a1a24;border:1px solid rgba(255,255,255,0.1);border-radius:16px;
    padding:32px;max-width:380px;width:90%;font-family:-apple-system,sans-serif;
  `;

  function render() {
    const step = steps[current];
    const dots = steps.map((_, i) =>
      `<span style="width:6px;height:6px;border-radius:50%;background:${i === current ? '#6366f1' : 'rgba(255,255,255,0.2)'};display:inline-block;margin:0 3px"></span>`
    ).join('');

    card.innerHTML = `
      <div style="font-size:11px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:#6366f1;margin-bottom:10px">
        step ${current + 1} of ${steps.length}
      </div>
      <h2 style="font-size:20px;font-weight:500;color:#f0f0f5;margin-bottom:12px">${step.title}</h2>
      <p style="font-size:14px;color:rgba(240,240,245,0.6);line-height:1.7;margin-bottom:28px">${step.body}</p>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>${dots}</div>
        <button id="onboard-btn" style="background:#6366f1;border:none;border-radius:8px;color:white;
          font-size:13px;font-weight:500;padding:10px 20px;cursor:pointer">${step.btn}</button>
      </div>
    `;

    document.getElementById('onboard-btn').addEventListener('click', () => {
      current++;
      if (current >= steps.length) {
        overlay.remove();
        localStorage.setItem('drift_onboarded', 'true');
      } else {
        render();
      }
    });
  }

  overlay.appendChild(card);
  document.body.appendChild(overlay);
  render();
}