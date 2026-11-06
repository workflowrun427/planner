// Подставка, чтобы логика приложения запускалась без браузера (в движке jsc).
var window = this;
var __ls = {};
var localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(__ls, k) ? __ls[k] : null; },
  setItem: function (k, v) { __ls[k] = String(v); },
  removeItem: function (k) { delete __ls[k]; }
};
var __fails = 0, __count = 0;
function check(name, cond) {
  __count++;
  if (cond) print('  ok   ' + name);
  else { __fails++; print('  FAIL ' + name); }
}
function finish() {
  print('\n' + (__count - __fails) + ' из ' + __count + ' проверок прошли');
  if (__fails) throw new Error('Есть упавшие проверки');
}
