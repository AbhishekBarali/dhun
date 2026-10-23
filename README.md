# Dhun · धुन

Make a music video for YouTube on your phone. Pick a song, a photo and a look,
and Dhun turns them into a video where the picture moves with the music.

**Open it:** https://abhishekbarali.github.io/dhun/

It's free, there's no app to install, and nothing is uploaded: the video is
made on the phone itself.

## How to make a video

1. **Song and photo.** Tap *Choose song* and pick the music file, then
   *Choose photo* and pick the picture.
2. **Pick a look.** Scroll through the looks: simple waves, Nepali (Himalaya,
   Pahad, Kathmandu, prayer flags, lali gurans, diyo, mandala, madal, sarangi,
   Dhaka, Tihar), hip-hop & rap, dance & party, and calm & sad. Tap one to see
   it with your photo. Press ▶ to hear the song and watch it move.
3. **Words.** The song name is filled in from the file name. Change it, add a
   second line (singer or channel), or add more words. Untick *Show* to make a
   video with no words. Tap any words on the video to change the font, size,
   colour and style. Drag them to move them.
4. **Intro and ending (optional).** Add your own clip or picture to play before
   and after the song. Turn on *Use them for every video* and they'll be there
   next time too.
5. **More options.** Wide for YouTube, tall for Shorts, or square. Colours,
   a wave at the bottom on any look, using only part of the song, slow zoom,
   words bouncing with the beat.
6. **Make video.** Type a name and tap *Make video*. The phone builds the video
   frame by frame, usually faster than the song plays. If the screen turns off,
   it carries on when you open it again. Then tap *Save video* and choose
   *Save Video* to put it in Photos. (On older phones it records in real time
   instead, so keep the screen open.)

Try *15-second test* first the very first time, to check the sound and picture.

**Tip (iPhone):** in Safari, tap Share → *Add to Home Screen*. Dhun then opens
like an app.

## नेपालीमा

१. **गीत र फोटो:** *गीत छान्नुहोस्* थिचेर गीत, अनि *फोटो छान्नुहोस्* थिचेर तस्बिर छान्नुहोस्।
२. **डिजाइन:** मन पर्ने डिजाइन थिच्नुहोस्। ▶ थिचेर गीतसँगै हेर्नुहोस्।
३. **अक्षर:** गीतको नाम र च्यानलको नाम लेख्नुहोस्। अक्षर नचाहिए *देखाउने* को टिक हटाउनुहोस्। भिडियोमा अक्षर थिचेर फन्ट, साइज, रङ बदल्नुहोस्, तानेर जहाँ पनि सार्नुहोस्।
४. **सुरु र अन्त्य:** चाहिए आफ्नै भिडियो वा फोटो गीतको अगाडि र पछाडि राख्नुहोस्।
५. **भिडियो बनाउनुहोस्:** नाम लेखेर *भिडियो बनाउनुहोस्* थिच्नुहोस्। फोनले भिडियो प्रायः गीतभन्दा छिटो बनाउँछ। स्क्रिन बन्द भए खोलेपछि फेरि अगाडि बढ्छ। सकिएपछि *भिडियो सेभ गर्नुहोस्* थिचेर *Save Video* छान्नुहोस्।

पहिलो पटक *१५ सेकेन्डको जाँच* गरेर आवाज र तस्बिर ठीक छ कि हेर्नुहोस्।

## For developers

Plain HTML, CSS and JavaScript modules. No build step, no server code.

- `index.html`, `css/app.css`, `js/app.js`: the screen
- `js/audio.js`: plays the song through Web Audio and measures bass, beats and the spectrum
- `js/renderer.js`: the frame, the intro → song → ending timeline
- `js/exporter.js`: fast export with WebCodecs (H.264 + AAC on iPhone) and the
  bundled [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) (MIT, `js/vendor/`)
- `js/recorder.js`: real-time fallback with MediaRecorder; add `?realtime` to the URL to force it
- `js/overlays.js`: the optional bottom wave, bars or line
- `js/templates/`: the looks, one file per family. See [docs/templates.md](docs/templates.md) to add one
- `dev/gallery.html`: every look side by side with made-up music, for checking changes

Run it locally with any static server, e.g.
`python3 -m http.server 8000 --bind 127.0.0.1`, then open
http://127.0.0.1:8000/ (and `/dev/gallery.html`).
