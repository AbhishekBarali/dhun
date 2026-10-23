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
   prayer flags, lali gurans, diyo, Dhaka, Tihar, village hills), hip-hop & rap,
   dance & party, and calm & sad. Tap one to see it with your photo. Press ▶ to
   hear the song and watch it move.
3. **Words.** The song name is filled in from the file name. Change it, add a
   second line (singer or channel), or add more words. Tap any words on the
   video to change the font, size, colour and style. Drag them to move them.
4. **Intro and ending (optional).** Add your own clip or picture to play before
   and after the song. Turn on *Use them for every video* and they'll be there
   next time too.
5. **More options.** Wide for YouTube, tall for Shorts, or square. Colours,
   using only part of the song, slow zoom, words bouncing with the beat.
6. **Make video.** Type a name and tap *Make video*. Keep the screen open while
   it records. It takes as long as the video. Then tap *Save video* and choose
   *Save Video* to put it in Photos.

Try *15-second test* first the very first time, to check the sound and picture.

**Tip (iPhone):** in Safari, tap Share → *Add to Home Screen*. Dhun then opens
like an app.

## नेपालीमा

१. **गीत र फोटो:** *गीत छान्नुहोस्* थिचेर गीत, अनि *फोटो छान्नुहोस्* थिचेर तस्बिर छान्नुहोस्।
२. **डिजाइन:** मन पर्ने डिजाइन थिच्नुहोस्। ▶ थिचेर गीतसँगै हेर्नुहोस्।
३. **अक्षर:** गीतको नाम र च्यानलको नाम लेख्नुहोस्। भिडियोमा अक्षर थिचेर फन्ट, साइज, रङ बदल्नुहोस्, तानेर जहाँ पनि सार्नुहोस्।
४. **सुरु र अन्त्य:** चाहिए आफ्नै भिडियो वा फोटो गीतको अगाडि र पछाडि राख्नुहोस्।
५. **भिडियो बनाउनुहोस्:** नाम लेखेर *भिडियो बनाउनुहोस्* थिच्नुहोस्। बन्दासम्म स्क्रिन खुलै राख्नुहोस्। सकिएपछि *भिडियो सेभ गर्नुहोस्* थिचेर *Save Video* छान्नुहोस्।

पहिलो पटक *१५ सेकेन्डको जाँच* गरेर आवाज र तस्बिर ठीक छ कि हेर्नुहोस्।

## For developers

Plain HTML, CSS and JavaScript modules. No build step, no server code.

- `index.html`, `css/app.css`, `js/app.js`: the screen
- `js/audio.js`: plays the song through Web Audio and measures bass, beats and the spectrum
- `js/renderer.js`: the frame, the intro → song → ending timeline
- `js/recorder.js`: records the canvas and sound with MediaRecorder (MP4 on iPhone)
- `js/templates/`: the looks, one file per family. See [docs/templates.md](docs/templates.md) to add one
- `dev/gallery.html`: every look side by side with made-up music, for checking changes

Run it locally with any static server, e.g.
`python3 -m http.server 8000 --bind 127.0.0.1`, then open
http://127.0.0.1:8000/ (and `/dev/gallery.html`).
