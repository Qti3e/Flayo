<?php
require_once('./php/index.php');

class App extends Flayo{
  function onMessage($client, $message){
    $client->send('Hello from ' . strrev($message));
  }

  function onConnect($client){
    $client->x = 4;
  }

  function onClose($client){

  }
}

$app = new App();
$app->start();
