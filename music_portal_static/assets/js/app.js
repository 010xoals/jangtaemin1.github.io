
document.addEventListener('DOMContentLoaded', () => {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // Vote component (simple localStorage demo)
  document.querySelectorAll('[data-vote]').forEach(btn => {
    btn.addEventListener('click', () => {
      const k = 'vote:' + btn.dataset.vote;
      if (localStorage.getItem(k)) {
        alert('You already voted for ' + btn.dataset.vote);
        return;
      }
      localStorage.setItem(k, '1');
      btn.textContent = 'Thanks for voting!';
      btn.classList.add('voted');
    });
  });
});
