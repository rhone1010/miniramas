/** Presentation only. CC supplies all three views of one immutable final wrap.
 * No generation, cropping, placement, payment or acceptance calls belong here.
 */
export function mountMugReview(host, composition) {
  const { identity, views, fixture = false } = composition;
  if (!identity?.generationId || !identity?.sha256 || !(identity.width > 0) || !(identity.height > 0)) throw Error('mug_wrap_identity_required');
  const names = ['Front', 'Back', 'Full Wrap'];
  for (const name of names) {
    const item = views?.[name];
    if (!item?.url || item.generationId !== identity.generationId || item.sha256 !== identity.sha256) throw Error('mug_view_identity_mismatch');
  }
  const root = document.createElement('section');
  const controls = document.createElement('div');
  controls.className = 'sizes';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Mug views');
  const picture = document.createElement('img');
  picture.className = 'gift-feature-image';
  const inspect = document.createElement('a');
  inspect.target = '_blank'; inspect.rel = 'noopener';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const reviewed = new Set();
  let current = 'Front';
  const buttons = names.map(name => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = name;
    button.onclick = () => show(name);
    controls.append(button); return button;
  });
  function show(name) {
    current = name;
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(names[i] === name)));
    picture.alt = name;
    picture.onload = () => { reviewed.add(name); status.textContent = fixture ? 'Development fixture' : name; };
    picture.onerror = () => { status.textContent = 'Not currently available'; };
    picture.src = views[name].url;
    inspect.href = views[name].url;
    inspect.textContent = name;
  }
  if (fixture) {
    const disclosure = document.createElement('p');
    disclosure.textContent = 'Development fixture';
    root.append(disclosure);
  }
  root.append(controls, picture, inspect, status);
  host.replaceChildren(root);
  show(current);
  return {
    identity: Object.freeze({ ...identity }),
    get currentView() { return current; },
    get completeWrapReviewed() { return reviewed.has('Full Wrap'); },
    destroy() { root.remove(); }
  };
}
