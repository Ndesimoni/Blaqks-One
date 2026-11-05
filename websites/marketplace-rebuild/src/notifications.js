let timer;

export function notify(message) {
  const notice = document.querySelector('#notice');
  notice.textContent = message;
  clearTimeout(timer);
  timer = setTimeout(() => { notice.textContent = ''; }, 5000);
}
