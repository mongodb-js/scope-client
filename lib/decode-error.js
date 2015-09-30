/* eslint no-caller:0 */
function decode_error(err) {
  if (err.response) {
    err = new Error(err.response.body.message);
    Error.captureStackTrace(err, arguments.callee);
  } else if (err.res) {
    err = new Error(err.res.body.message);
    Error.captureStackTrace(err, arguments.callee);
  } else if (err.code === 'ECONNREFUSED') {
    err.message = 'scout-server not running on endpoint?';
  } else if (err.message === 'Origin is not allowed by Access-Control-Allow-Origin') {
    err.message = 'scout-server not running on endpoint?';
  }
  return err;
}

module.exports = decode_error;
