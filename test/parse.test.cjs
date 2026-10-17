const {test} = require('node:test');
const assert = require('node:assert/strict');
const parse = require('../src/parse.cjs');
test('finds giveaways including DLC and preserves displayed currency', () => {
  const html = '<a data-ds-appid="5007040"><img src="https://example.org/x.jpg?a=1&amp;b=2"><span class="title">A &amp; B</span><div data-price-final="0">-100%</div><div class="discount_original_price">20.99 SR</div></a>';
  assert.deepEqual(parse.offers(html), [{appId: '5007040', name: 'A & B', originalPrice: '20.99 SR', photo: 'https://example.org/x.jpg?a=1&b=2'}]);
});
test('does not discover paid discounts or permanently-free titles as giveaways', () => {
  assert.equal(parse.offers('<a data-ds-appid="1"><div data-price-final="999">-50%</div></a>').length, 0);
  assert.equal(parse.offers('<a data-ds-appid="1"><div data-price-final="0">Free To Play</div></a>').length, 0);
});
test('reads new license form and base game without accepting a paid cart subid', () => {
  const html = 'Free to keep. Requires the base game <a href="https://store.steampowered.com/app/10/">Base</a>' +
    '<form method="POST" action="/cart/"><input name="subid" value="999"></form>' +
    '<form action="https://store.steampowered.com/freelicense/addfreelicense/" method="POST"><input value="123" name="subid"></form>';
  const result = parse.page(html, '20');
  assert.deepEqual(result.packages, [{packageId: '123', form: true}]);
  assert.deepEqual(result.base, {appId: '10', name: 'Base'});
});
test('keeps ambiguous free packages for manual review', () => {
  assert.equal(parse.page('AddFreeLicense(123); AddFreeLicense(124)', '1').packages.length, 2);
});
test('rejects license forms that post outside Steam', () => {
  assert.equal(parse.page('<form method="POST" action="https://other.test/freelicense/addfreelicense/"><input name="subid" value="123"></form>', '1').packages.length, 0);
});
