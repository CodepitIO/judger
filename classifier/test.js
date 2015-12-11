var C = Math.log(0.1) * 100.0 / 70;

function get(x,y) {
  console.log(C * x / y);
  return Math.exp(C * x / y);
}

console.log(get(621,3487));
