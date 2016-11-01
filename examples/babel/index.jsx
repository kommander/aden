const fn = (str) => {
  let newStr = '';
  for (let i = 0; i < 5; i++) {
    newStr += str;
  }
  return newStr;
};
const ele = document.getElementById('test');
ele.innerHTML = fn('yeah!');
