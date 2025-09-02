<?php

class MyClass
{
    public function oldMethod($param)
    {
        echo "Hello " . $param;
    }
}

$obj = new MyClass();
$obj->oldMethod("World");
