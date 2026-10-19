## Two players joined:

2026-10-19T05:05:01Z app[80169db6494548] syd [info][player_connected] meow {"playerId":173,"name":"meow","mode":"claimed"}
2026-10-19T05:05:01Z app[80169db6494548] syd [info][role_changed] meow {"playerId":173,"name":"meow","from":null,"to":"active"}
2026-10-19T05:05:03Z app[80169db6494548] syd [info][player_connected] fsy {"playerId":171,"name":"fsy","mode":"resumed"}
2026-10-19T05:05:03Z app[80169db6494548] syd [info][role_changed] fsy {"playerId":171,"name":"fsy","from":null,"to":"starting"}
2026-10-19T05:05:05Z app[80169db6494548] syd [info][role_changed] fsy {"playerId":171,"name":"fsy","from":"starting","to":"active"}
2026-10-19T05:05:05Z app[80169db6494548] syd [info][positions_snapshot] meow,fsy {"players":[{"playerId":173,"name":"meow","x":0.5374269005847954,"y":0.8804983715582255},{"playerId":171,"name":"fsy","x":0.5354609929078015,"y":0.41372120916193184}]}


## ACtions of one user propagates to relvant users
Unable to see this, but am able to see positions of all users

2026-10-19T05:05:35Z app[80169db6494548] syd [info][positions_snapshot] meow,fsy,player44c9a9,player4d02f3 {"players":[{"playerId":173,"name":"meow","x":0.7894736842105263,"y":0.5988082307131551},{"playerId":171,"name":"fsy","x":0.8445626477541371,"y":0.705793936434659},{"playerId":172,"name":"player44c9a9","x":0.8616352201257862,"y":0.6553927680798005},{"playerId":174,"name":"player4d02f3","x":0.5038095238095238,"y":0.3199999999999994}]}


## Simuitaneuoise action
logged in order of processing

2026-10-19T05:45:36Z app[80169db6494548] syd [info][player_connected] fp {"playerId":181,"name":"fp","mode":"claimed"}
2026-10-19T05:45:36Z app[80169db6494548] syd [info][role_changed] fp {"playerId":181,"name":"fp","from":null,"to":"introducing"}
2026-10-19T05:45:38Z app[80169db6494548] syd [info][role_changed] fp {"playerId":181,"name":"fp","from":"introducing","to":"active"}
2026-10-19T05:45:43Z app[80169db6494548] syd [info][player_disconnected] aaa {"playerId":176,"name":"aaa","reason":"timeout"}
2026-10-19T05:45:43Z app[80169db6494548] syd [info][role_changed] aaa {"playerId":176,"name":"aaa","from":"active","to":"leaving"}
2026-10-19T05:45:44Z app[80169db6494548] syd [info][player_disconnected] ddd {"playerId":177,"name":"ddd","reason":"timeout"}
2026-10-19T05:45:44Z app[80169db6494548] syd [info][role_changed] ddd {"playerId":177,"name":"ddd","from":"active","to":"leaving"}
2026-10-19T05:45:44Z app[80169db6494548] syd [info][player_disconnected] bbb {"playerId":1,"name":"bbb","reason":"timeout"}
2026-10-19T05:45:44Z app[80169db6494548] syd [info][role_changed] bbb {"playerId":1,"name":"bbb","from":"active","to":"leaving"}
2026-10-19T05:45:44Z app[80169db6494548] syd [info][player_disconnected] fp {"playerId":181,"name":"fp","reason":"timeout"}
2026-10-19T05:45:44Z app[80169db6494548] syd [info][role_changed] fp {"playerId":181,"name":"fp","from":"active","to":"leaving"}
2026-10-19T05:45:44Z app[80169db6494548] syd [info][player_disconnected] eee {"playerId":178,"name":"eee","reason":"timeout"}
2026-10-19T05:45:44Z app[80169db6494548] syd [info][role_changed] eee {"playerId":178,"name":"eee","from":"active","to":"leaving"}
2026-10-19T05:45:46Z app[80169db6494548] syd [info][role_changed] aaa {"playerId":176,"name":"aaa","from":"leaving","to":"removed"}
2026-10-19T05:45:46Z app[80169db6494548] syd [info][role_changed] ddd {"playerId":177,"name":"ddd","from":"leaving","to":"removed"}
2026-10-19T05:45:46Z app[80169db6494548] syd [info][role_changed] bbb {"playerId":1,"name":"bbb","from":"leaving","to":"removed"}
2026-10-19T05:45:46Z app[80169db6494548] syd [info][role_changed] fp {"playerId":181,"name":"fp","from":"leaving","to":"removed"}
2026-10-19T05:45:46Z app[80169db6494548] syd [info][role_changed] eee {"playerId":178,"name":"eee","from":"leaving","to":"removed"}


## Late user joins
no such thing

## Leave and rejoin

2026-10-19T05:45:36Z app[80169db6494548] syd [info][player_connected] fp {"playerId":181,"name":"fp","mode":"claimed"}
2026-10-19T05:45:36Z app[80169db6494548] syd [info][role_changed] fp {"playerId":181,"name":"fp","from":null,"to":"introducing"}
2026-10-19T05:45:38Z app[80169db6494548] syd [info][role_changed] fp {"playerId":181,"name":"fp","from":"introducing","to":"active"}
2026-10-19T05:45:43Z app[80169db6494548] syd [info][player_disconnected] aaa {"playerId":176,"name":"aaa","reason":"timeout"}
2026-10-19T05:45:43Z app[80169db6494548] syd [info][role_changed] aaa {"playerId":176,"name":"aaa","from":"active","to":"leaving"}
2026-10-19T05:45:44Z app[80169db6494548] syd [info][player_disconnected] ddd {"playerId":177,"name":"ddd","reason":"timeout"}
2026-10-19T05:45:44Z app[80169db6494548] syd [info][role_changed] ddd {"playerId":177,"name":"ddd","from":"active","to":"leaving"}
2026-10-19T05:45:44Z app[80169db6494548] syd [info][player_disconnected] bbb {"playerId":1,"name":"bbb","reason":"timeout"}
2026-10-19T05:45:44Z app[80169db6494548] syd [info][role_changed] bbb {"playerId":1,"name":"bbb","from":"active","to":"leaving"}
2026-10-19T05:45:44Z app[80169db6494548] syd [info][player_disconnected] fp {"playerId":181,"name":"fp","reason":"timeout"}
2026-10-19T05:45:44Z app[80169db6494548] syd [info][role_changed] fp {"playerId":181,"name":"fp","from":"active","to":"leaving"}
2026-10-19T05:45:44Z app[80169db6494548] syd [info][player_disconnected] eee {"playerId":178,"name":"eee","reason":"timeout"}
2026-10-19T05:45:44Z app[80169db6494548] syd [info][role_changed] eee {"playerId":178,"name":"eee","from":"active","to":"leaving"}
2026-10-19T05:45:46Z app[80169db6494548] syd [info][role_changed] aaa {"playerId":176,"name":"aaa","from":"leaving","to":"removed"}
2026-10-19T05:45:46Z app[80169db6494548] syd [info][role_changed] ddd {"playerId":177,"name":"ddd","from":"leaving","to":"removed"}
2026-10-19T05:45:46Z app[80169db6494548] syd [info][role_changed] bbb {"playerId":1,"name":"bbb","from":"leaving","to":"removed"}
2026-10-19T05:45:46Z app[80169db6494548] syd [info][role_changed] fp {"playerId":181,"name":"fp","from":"leaving","to":"removed"}
2026-10-19T05:45:46Z app[80169db6494548] syd [info][role_changed] eee {"playerId":178,"name":"eee","from":"leaving","to":"removed"}


## Isolated room joins
- no separate rooms


## scale machines
 unable to get the 2nd machine

# Restart machine
games disconnect - no logs

2026-10-19T05:53:40Z app[80169db6494548] syd [info] INFO Sending signal SIGINT to main child process w/ PID 643
2026-10-19T05:53:41Z app[80169db6494548] syd [info] INFO Main child exited with signal (with signal 'SIGINT', core dumped? false)
2026-10-19T05:53:41Z app[80169db6494548] syd [info] INFO Starting clean up.
2026-10-19T05:53:41Z app[80169db6494548] syd [info] INFO Umounting /dev/vdc from /data
2026-10-19T05:53:41Z app[80169db6494548] syd [info][  383.321735] reboot: Restarting system
2026-10-19T05:53:42Z app[80169db6494548] syd [info]2026-10-19T05:53:42.025090051 [01M54G9G03FDQSCBDVP6SFSVVG:main] Running Firecracker v1.14.4
2026-10-19T05:53:42Z app[80169db6494548] syd [info]2026-10-19T05:53:42.025325476 [01M54G9G03FDQSCBDVP6SFSVVG:main] Listening on API socket ("/fc.sock").
2026-10-19T05:53:42Z app[80169db6494548] syd [info] INFO Starting init (commit: 6172d83)...
2026-10-19T05:53:42Z app[80169db6494548] syd [info] INFO Checking filesystem on /data
2026-10-19T05:53:42Z app[80169db6494548] syd [info]/dev/vdc: clean, 14/64512 files, 10329/258048 blocks
2026-10-19T05:53:42Z app[80169db6494548] syd [info] INFO Mounting /dev/vdc at /data w/ uid: 0, gid: 0 and chmod 0755
2026-10-19T05:53:42Z app[80169db6494548] syd [info] INFO Resized /data to 1056964608 bytes
2026-10-19T05:53:42Z app[80169db6494548] syd [info] INFO Preparing to run: `docker-entrypoint.sh node src/server/index.ts` as root
2026-10-19T05:53:42Z app[80169db6494548] syd [info] INFO [fly api proxy] listening at /.fly/api
2026-10-19T05:53:43Z app[80169db6494548] syd [info]2026/10/19 05:53:43 INFO SSH listening listen_address=[fdaa:c0:ebc7:a7b:2db:bffd:879f:2]:22
2026-10-19T05:53:43Z runner[80169db6494548] syd [info]Machine started in 1.287s
2026-10-19T05:53:45Z app[80169db6494548] syd [info]Collective Snake listening on 0.0.0.0:8080