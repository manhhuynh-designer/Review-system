const mockAttachments = [
    {
        type: 'image',
        url: 'https://firebasestorage.googleapis.com/v0/b/linkweb-review.appspot.com/o/comments%2Fproject-1%2Fcomment-1%2F1734000000000_0_test-virus-file.png?alt=media&token=xyz',
        name: 'test-virus-file.png',
        validationStatus: 'pending'
    }
];

const uploadedFileName = 'test-virus-file.png';
const fileNameInStorage = '1734000000000_0_test-virus-file.png';

function validate(attachments, fileName) {
    let status = 'infected';
    let found = false;

    // Logic from functions/index.js
    const updatedAttachments = attachments.map(att => {
        // Check 1: encodeURIComponent match
        if (att.url && att.url.includes(encodeURIComponent(fileName))) {
            console.log('Matched via encodeURIComponent');
            found = true;
            return { ...att, validationStatus: status };
        }
        // Check 2: decodeURIComponent match
        if (att.url && decodeURIComponent(att.url).includes(fileName)) {
            console.log('Matched via decoding URL');
            found = true;
            return { ...att, validationStatus: status };
        }
        return att;
    });

    console.log('Found:', found);
    return updatedAttachments;
}

const result = validate(mockAttachments, uploadedFileName);
console.log(JSON.stringify(result, null, 2));
