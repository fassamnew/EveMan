const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { StatusBadge } = require('./index');

test('StatusBadge returns a valid React element', () => {
  const element = StatusBadge({ label: 'ok', tone: 'success' });
  assert.equal(React.isValidElement(element), true);
  assert.equal(element.props.children, 'ok');
});
