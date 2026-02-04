document.addEventListener('DOMContentLoaded', () => {
  const generateButton = document.getElementById('generateLotto');
  const lottoNumbersDiv = document.getElementById('lottoNumbers');

  generateButton.addEventListener('click', () => {
    lottoNumbersDiv.innerHTML = ''; // Clear previous numbers
    const numbers = generateLottoNumbers();
    numbers.forEach(num => {
      const span = document.createElement('span');
      span.textContent = num;
      span.style.margin = '5px';
      span.style.padding = '10px';
      span.style.border = '1px solid black';
      span.style.borderRadius = '5px';
      span.style.display = 'inline-block';
      lottoNumbersDiv.appendChild(span);
    });
  });

  function generateLottoNumbers() {
    const numbers = new Set();
    while (numbers.size < 6) {
      numbers.add(Math.floor(Math.random() * 45) + 1);
    }
    return Array.from(numbers).sort((a, b) => a - b);
  }
});