const gitbook = require('gitbook')
const deployToGithubPages = require('gh-pages-deploy')

module.exports = function (attitude) {
  attitude.registerFolder('gitbookFolder', /book|docs/)
  attitude.hook('build', (aden, page) => {
    gitbook.build({
      from: page.gitbookFolder.resolved,
      to: page.gitbookFolder.dist
    })
  })
  attitude.hook('dev', (aden, page) => {
    gitbook.runDevServer({
      from: page.gitbookFolder.resolved
    })
  })
  attitude.hook('deploy', (target, aden, page) => {
    switch (target) {
      case 'gh-pages': {
        return deployToGithubPages({ from: page.gitbookFolder.dist })
      }
    }
  })
  attitude.hook('run:suite', ({ suite }) => {})
}
