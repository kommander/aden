const fn = ({ ...rest }) => console.log({ additional: 'value', ...rest });
fn({ one: 'value' });