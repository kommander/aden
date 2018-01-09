const lib = require('./')
const bytes = require('pretty-bytes')

before((done) => {
  lib.setup().then(() => done())
})

const memTrace = []

afterEach(() => {
  if (typeof global.gc === 'function') {
    global.gc()
    const memUsage = process.memoryUsage()
    memTrace.push(memUsage)
  }
})

const bySize = (a, b) => (a > b ? 1 : (a < b ? -1 : 0))

after(() => {
  if (memTrace.length > 1) {
    const averageHeapUsage = Math.round(memTrace.reduce((prev, cur) =>
      (prev + cur.heapUsed), 0) / memTrace.length)
    const averageHeapTotal = Math.round(memTrace.reduce((prev, cur) =>
      (prev + cur.heapTotal), 0) / memTrace.length)
    const sortedUsage = memTrace
      .map((mem) => mem.heapUsed)
      .sort(bySize)
    const maxUsage = sortedUsage.pop()
    const minUsage = sortedUsage.shift()
    const sortedTotal = memTrace
      .map((mem) => mem.heapTotal)
      .sort(bySize)
    const maxTotal = sortedTotal.pop()
    const minTotal = sortedTotal.shift()

    console.log('  Memory Usage during tests')
    console.log(
      '  Average heap usage:',
      bytes(averageHeapUsage),
      `(min. ${bytes(minUsage)} / max. ${bytes(maxUsage)})`
    )
    console.log(
      '  Average heap total:',
      bytes(averageHeapTotal),
      `(min. ${bytes(minTotal)} / max. ${bytes(maxTotal)})`
    )
  }
})

process.on('uncaughtException', (ex) => {
  console.error('TEST FATAL: Uncaught Exception', ex); // eslint-disable-line
})

process.on('unhandledRejection', (reason) => {
  console.error('TEST FATAL: Unhandled Promise Rejection', reason); // eslint-disable-line
})
