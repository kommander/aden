module.exports = (aden) => {
  aden.hook('setup:route', ({ page }) => {
    Object.assign(page, {
      get: (req, res) => res.send('custom path attitude')
    })
  })
}
