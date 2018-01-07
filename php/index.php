<?php
class FlayoClient{
  private $id;
  private $props;
  private $changedProps = [];

  public function __construct($id, $props){
    $this->id = $id;
    $this->props = $props;
  }

  public function getID(){
    return $this->id;
  }

  public function __set($name, $value){
    if($name == 'id')
      return false;
    array_push($this->changedProps, $name);
    return $this->props[$name] = $value;
  }

  public function __get($name){
    if($name == 'id')
      return $this->id;
    return $this->props[$name];
  }

  public function __destruct(){
    $j = [];
    $c = count($this->changedProps) - 1;
    for(;$c >= 0;$c--){
      $key = $this->changedProps[$c];
      $j[$key] = $this->props[$key];
    }
    $data = [];
    $data['client'] = $this->id;
    $data['vals'] = $j;
    if(count($j) == 0)
      return;
    echo "#u" . json_encode($data) . "\n";
  }

  public function send($message){
    $data = [];
    $data['client'] = $this->id;
    $data['message'] = $message;
    echo '#s' . json_encode($data) . "\n";
  }
}

function send($selector, $message){
  $data = [];
  $data['client'] = $selector;
  $data['message'] = $message;
  echo '#s' . json_encode($data) . "\n";
}

class Flayo{
  public function start(){
    while($line = fgets(STDIN)){
      $data = json_decode($line, true);
      $client = new FlayoClient($data['client']['id'], $data['client']);
      switch ($data['type']) {
        case 'connect':
          $this->onConnect($client);
          break;

        case 'close':
          $this->onClose($client);
          break;

        case 'message':
          $this->onMessage($client, $data['data']);
          break;
      }
      $client->__destruct();
      echo "#r" . "\n";
    }
  }

  public function onMessage($client, $message){}

  public function onConnect($client){}

  public function onClose($client){}
}
