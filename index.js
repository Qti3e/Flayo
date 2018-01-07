const os  = require('os')
const child_process = require('child_process')
const async = require('async')
const WebSocket = require('ws')
const shortid = require('shortid')
const jsonQuery = require('json-query')
const spawn = child_process.spawn
const isWin = os.platform().indexOf('win') > -1

const exec = ['php', 'app/index.php']
const clusters = os.cpus().length // number of threads to run
const wsOptions = {
  port: 8080
}

if(isWin){
  console.error('Sorry, but this is a Linux-only project!')
  return
}

let PHPWorkers = []

let cpus = os.cpus().length
for(let i = 0;i < clusters;i++){
  PHPWorkers.push({
    task: null,
    done: 0,
    isReady: true,
    id: i
  })

  PHPWorkers[i].task = spawn('taskset', (['-c', i % cpus]).concat(exec), {
    cwd: process.cwd()
  })
  PHPWorkers[i].task.stdout.on('data', dataHandler.bind(this, i))
  PHPWorkers[i].task.stderr.on('data', (data) => {
    console.error(data.toString())
  })
  PHPWorkers[i].task.on('close', function(code){
    PHPWorkers[i].isReady = false
    PHPWorkers[i].task = null
    console.log('PHP cluster exited with code ', code)
  })
}

let messageQueue = []
let clients = []
let id2index = {}

function sendMessage(){
  let freeWorkers = PHPWorkers.filter(x => x.isReady)
  if(freeWorkers.length == 0 || messageQueue.length == 0)
    return
  let minDone = Math.min.apply(this, freeWorkers.map(x => x.done))
  let worker = freeWorkers.filter(x => x.done == minDone)[0]
  let message = messageQueue.shift()
  message.client = clients.filter(x => x.id == message.client)[0]
  worker.done++
  worker.isReady = false
  worker.task.stdin.write(JSON.stringify(message) + "\n")
}

function push(data){
  messageQueue.push(data)
  sendMessage()
}

function userSelector(selector){
  let re = []
  let x
  if(selector[0] == '!' && selector.length == 10){
    x = true
    for(let i in clients)
      if(clients[i].id == selector)
        re.push(clients[i])
  }

  re = x ? re : jsonQuery(selector, {
    data: clients
  }).value

  re = re.filter(x => x._ws_.isAlive && x._ws_.readyState === WebSocket.OPEN)

  return re
}

function dataHandler(core, message){
  if(typeof message !== 'string')
    message = message.toString()
  arrayOfLines = message.match(/[^\r\n]+/g)
  if(arrayOfLines.length > 1)
    return arrayOfLines.map(x => dataHandler(core, x))
  message = arrayOfLines[0]
  if(message[0] !== '#')
    return
  message = message.substr(1)
  let data, users
  switch (message[0]) {
    case 'r': //ready
      PHPWorkers[core].isReady = true
      sendMessage()
      break
    case 's': //send
      data = JSON.parse(message.substr(1))
      users = userSelector(data.client)
      for(let i in users)
        users[i]._ws_.send(JSON.stringify(data.message))
      break
    case 'u': //update
      data = JSON.parse(message.substr(1))
      users = userSelector(data.client)
      let d = data.vals
      for(let i in users){
        d.id = users[i].id
        d._ws_ = users[i]._ws_
        for(let key in d){
          clients[id2index[d.id]][key] = d[key]
        }
      }
      break
  }
}

const wss = new WebSocket.Server(wsOptions)

function noop() {}

function heartbeat() {
  this.isAlive = true
}

wss.on('connection', function connection(ws) {
  ws.toJSON = function(){return null}
  ws.isAlive = true
  ws.on('pong', heartbeat)
  ws.id = '!' + shortid.generate()
  clients.push({id: ws.id, _ws_: ws})
  id2index[ws.id] = clients.length - 1

  push({type: 'connect', client: ws.id})

  ws.on('message', function incoming(message) {
    push({type: 'message', client: ws.id, data: message})
  })
})

setInterval(function ping() {
  clients = clients.filter(x => x._ws_.isAlive)
  for(let i in clients)
    id2index[clients[i].id] = i
  wss.clients.forEach(function each(ws) {
    if(ws.isAlive === false){
      push({type: 'close', client: ws.id})
      return ws.terminate()
    }
    ws.isAlive = false
    ws.ping(noop)
  })
}, 30000)

// function test(){
//   let id = '!' + shortid.generate()
//   let ws = {
//     id,
//     isAlive: true,
//     readyState: WebSocket.OPEN,
//     send(message){
//       console.log('ws:' + id + ' <', message)
//     }
//   }
//   ws.toJSON = function(){return null}
//   clients.push({id: ws.id, _ws_: ws})
//
//   id2index[id] = clients.length - 1
//
//   push({type: 'connect', client: ws.id})
//
//   setTimeout(function(){
//     push({type: 'message', client: ws.id, data: 'Google'})
//   }, 500)
// }
// test()

sendMessage()
