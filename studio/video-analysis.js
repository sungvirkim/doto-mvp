// Each editor owns one analysis. Replacing a clip invalidates any older response.
export function videoAnalysis({connected, analyze, report, initialVideo}) {
  let video = initialVideo;
  let automatic = true;
  let active;
  let stage = 'ready';
  function show(next, payload) {
    stage = next;
    report(next, payload, video);
  }
  function cancel() {
    if (active) active.abort();
    active = undefined;
  }
  async function start() {
    if (!video || active || !automatic || stage === 'done') return;
    if (!connected()) { show('connect'); return; }
    const task = new AbortController();
    active = task;
    show('loading');
    try {
      const result = await analyze(video, task.signal);
      if (active === task) show('done', result);
    } catch (error) {
      if (active === task) show('error', error.message);
    } finally {
      if (active === task) active = undefined;
    }
  }
  function select(next) {
    if (next?.id === video?.id) return;
    cancel();
    video = next;
    show('ready');
    if (video && automatic) void start();
  }
  function enable(value) {
    automatic = value;
    if (!value) { cancel(); show('ready'); }
    else void start();
  }
  function connectionChanged() {
    if (stage === 'connect' && connected()) void start();
    if (active && !connected()) { cancel(); show('connect'); }
  }
  return {select, enable, start, connectionChanged, cancel};
}
